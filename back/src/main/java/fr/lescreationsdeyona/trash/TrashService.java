package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.category.CategoryService;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ImageStorage;
import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.recipe.RecipeDetail;
import fr.lescreationsdeyona.recipe.RecipeLinks;
import fr.lescreationsdeyona.recipe.RecipeService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The trash of the back-office: deleted recipes, categories, menus and photos are kept 30 days (see
 * {@link TrashBin}), then erased every night. Each one is restored by the service that deleted it.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TrashService {

	static final Duration KEPT = Duration.ofDays(30);

	private static final Logger log = LoggerFactory.getLogger(TrashService.class);

	private final TrashItemRepository trashRepository;

	private final TrashBin trashBin;

	private final RecipeService recipeService;

	private final CategoryService categoryService;

	private final MenuService menuService;

	private final ImageService imageService;

	/** The last deleted first. */
	public List<TrashedItem> list() {
		return trashRepository.findAllByOrderByDeletedAtDesc()
			.stream()
			.map(item -> new TrashedItem(item.getId(), item.getKind(), item.getTitle(), item.getStatus(),
					item.getImage() == null ? null : item.getImage().getId(), item.getDeletedAt(), item.getDeletedBy(),
					item.getDeletedAt().plus(KEPT)))
			.toList();
	}

	public long count() {
		return trashRepository.count();
	}

	/** Created again as it was, by the service that deleted it, then taken out of the trash. */
	@Transactional
	public TrashRestored restore(long id) {
		TrashItem item = find(id);
		TrashRestored restored = switch (item.getKind()) {
			case RECIPE -> {
				RecipeDetail recipe = recipeService.restoreFromTrash(item);
				int menus = menuService.addBack(recipe.id(),
						trashBin.links(item, RecipeLinks.class, RecipeLinks.NONE).menus());
				yield new TrashRestored(TrashKind.RECIPE, recipe.title(), recipe.id(), recipe.status(), menus);
			}
			case CATEGORY -> {
				CategoryResponse category = categoryService.restoreFromTrash(item);
				yield new TrashRestored(TrashKind.CATEGORY, category.name(), category.id(), null, 0);
			}
			case MENU -> {
				AdminMenu menu = menuService.restoreFromTrash(item);
				yield new TrashRestored(TrashKind.MENU, menu.title(), menu.id(), null, menu.recipes().size());
			}
			case IMAGE -> new TrashRestored(TrashKind.IMAGE, item.getTitle(), null, null, imageService.restoreFromTrash(item));
		};
		trashRepository.delete(item);
		return restored;
	}

	/** A deleted photo, to show it in the trash. */
	public ImageStorage.StoredFile openImage(long id) {
		TrashItem item = find(id);
		if (item.getKind() != TrashKind.IMAGE) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return imageService.openFromTrash(item);
	}

	/** For good, before its 30 days. A recipe's or a category's photo stays in the gallery; a photo's files go. */
	@Transactional
	public void erase(long id) {
		erase(List.of(find(id)));
	}

	/** "Vider la corbeille". */
	@Transactional
	public void eraseAll() {
		erase(trashRepository.findByKind(TrashKind.IMAGE));
		trashRepository.deleteAllInBatch();
	}

	/** Every night, what was deleted more than 30 days ago. */
	@Scheduled(cron = "0 30 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		Instant before = Instant.now().minus(KEPT);
		erase(trashRepository.findByKindAndDeletedAtBefore(TrashKind.IMAGE, before));
		int erased = trashRepository.deleteDeletedBefore(before);
		if (erased > 0) {
			log.info("{} item(s) erased from the trash after {} days", erased, KEPT.toDays());
		}
	}

	private void erase(List<TrashItem> items) {
		items.stream().filter(item -> item.getKind() == TrashKind.IMAGE).forEach(imageService::eraseFromTrash);
		trashRepository.deleteAll(items);
	}

	private TrashItem find(long id) {
		return trashRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.TRASH_ITEM_NOT_FOUND));
	}

}
