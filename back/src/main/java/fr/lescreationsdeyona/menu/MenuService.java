package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuResponses.MenuDetail;
import fr.lescreationsdeyona.menu.MenuResponses.MenuRecipe;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeLinks;
import fr.lescreationsdeyona.recipe.RecipeMapper;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MenuService {

	/** Recipes of a menu, at most (see MenuForm). */
	private static final int MAX_RECIPES = 12;

	private final MenuRepository menuRepository;

	private final RecipeRepository recipeRepository;

	private final RecipeMapper recipeMapper;

	private final ImageService imageService;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	// Public site: published menus, their published recipes only

	/** The latest updated first; a menu without published recipe is left out. */
	public List<MenuSummary> listPublished() {
		return menuRepository.findByPublishedTrueOrderByUpdatedAtDesc()
			.stream()
			.map(menu -> summary(menu, true))
			.filter(summary -> summary.recipeCount() > 0)
			.toList();
	}

	public MenuDetail getPublished(String slug) {
		Menu menu = menuRepository.findBySlugAndPublishedTrue(slug)
			.orElseThrow(() -> new ApiException(ErrorCode.MENU_NOT_FOUND));
		List<Recipe> recipes = published(menu);
		if (recipes.isEmpty()) {
			throw new ApiException(ErrorCode.MENU_NOT_FOUND);
		}
		return new MenuDetail(menu.getTitle(), menu.getSlug(), menu.getIntro(), imageId(menu.getImage()),
				recipes.stream().map(recipeMapper::toCard).toList(), menu.getUpdatedAt());
	}

	// Back-office

	public List<MenuSummary> listAll() {
		return menuRepository.findAllByOrderByUpdatedAtDesc().stream().map(menu -> summary(menu, false)).toList();
	}

	public AdminMenu get(long id) {
		return toAdmin(find(id));
	}

	@Transactional
	public AdminMenu create(MenuForm form) {
		String title = title(form);
		if (menuRepository.findByTitle(title).isPresent()) {
			throw new ApiException(ErrorCode.MENU_ALREADY_EXISTS);
		}
		Menu menu = new Menu();
		menu.setSlug(Slugs.uniqueSlug(title, "menu", menuRepository::existsBySlug));
		AdminMenu created = save(menu, title, form);
		auditLog.record(AuditAction.CREATED, AuditKind.MENU, created.title(), created.id());
		return created;
	}

	@Transactional
	public AdminMenu update(long id, MenuForm form) {
		Menu menu = find(id);
		String title = title(form);
		if (menuRepository.findByTitle(title).filter(other -> !other.getId().equals(id)).isPresent()) {
			throw new ApiException(ErrorCode.MENU_ALREADY_EXISTS);
		}
		auditLog.record(AuditAction.UPDATED, AuditKind.MENU, title, id);
		return save(menu, title, form);
	}

	/** A new photo for a menu; the previous one stays in the gallery. */
	@Transactional
	public AdminMenu replaceImage(long id, ProcessedImage processed) {
		Menu menu = find(id);
		menu.setImage(imageService.create(ImageKind.MENU, processed));
		return toAdmin(menuRepository.saveAndFlush(menu));
	}

	/** A photo of the gallery on a menu, or none: it then shows the default visual. */
	@Transactional
	public AdminMenu chooseImage(long id, @Nullable UUID imageId) {
		Menu menu = find(id);
		menu.setImage(imageId == null ? null : imageService.getLandscape(imageId));
		return toAdmin(menuRepository.saveAndFlush(menu));
	}

	/** Moved to the trash, kept 30 days; its recipes stay, its photo too, in the gallery. */
	@Transactional
	public void delete(long id) {
		Menu menu = find(id);
		trashBin.put(TrashBin.Entry.of(TrashKind.MENU, menu.getTitle(), menu.getSlug(),
				menu.getImage(),
				new TrashedMenu(menu.getTitle(), menu.getSlug(), menu.getIntro(), menu.isPublished(), menu.getCreatedAt(),
						menu.getRecipes().stream().map(recipe -> new TrashedMenu.RecipeRef(recipe.getId(), recipe.getSlug())).toList(),
						imageId(menu.getImage()))));
		menuRepository.delete(menu);
	}

	/**
	 * Created again from the trash: same URL if still free, its recipes that still exist, in order,
	 * its photo if still in the gallery. Refused when another menu has taken its title meanwhile.
	 */
	@Transactional
	public AdminMenu restoreFromTrash(TrashItem trashed) {
		TrashedMenu kept = trashBin.content(trashed, TrashedMenu.class);
		if (menuRepository.findByTitle(kept.title()).isPresent()) {
			throw new ApiException(ErrorCode.MENU_ALREADY_EXISTS);
		}
		Menu menu = new Menu();
		menu.setTitle(kept.title());
		menu.setSlug(menuRepository.existsBySlug(kept.slug())
				? Slugs.uniqueSlug(kept.title(), "menu", menuRepository::existsBySlug)
				: kept.slug());
		menu.setIntro(kept.intro());
		menu.setPublished(kept.published());
		if (kept.imageId() != null) {
			imageService.find(kept.imageId()).ifPresent(menu::setImage);
		}
		kept.recipes().stream()
			.map(ref -> recipeRepository.findById(ref.id()).or(() -> recipeRepository.findBySlug(ref.slug())))
			.flatMap(Optional::stream)
			.distinct()
			.forEach(menu.getRecipes()::add);
		long id = menuRepository.saveAndFlush(menu).getId();
		menuRepository.restoreCreatedAt(id, kept.createdAt());
		return get(id);
	}

	/** The menus showing a recipe, and its place in each: kept with it in the trash. */
	public List<RecipeLinks.MenuPlace> placesOf(long recipeId) {
		return menuRepository.findPlacesOf(recipeId);
	}

	/**
	 * A recipe taken out of the trash goes back to its place in the menus that still exist and still
	 * have room. Returns the number of menus it is back in.
	 */
	@Transactional
	public int addBack(long recipeId, List<RecipeLinks.MenuPlace> places) {
		Recipe recipe = recipeRepository.getReferenceById(recipeId);
		int added = 0;
		for (RecipeLinks.MenuPlace place : places) {
			Optional<Menu> found = menuRepository.findById(place.menuId());
			if (found.isEmpty() || found.get().getRecipes().size() >= MAX_RECIPES
					|| found.get().getRecipes().stream().anyMatch(other -> other.getId() == recipeId)) {
				continue;
			}
			List<Recipe> recipes = found.get().getRecipes();
			recipes.add(Math.min(place.position(), recipes.size()), recipe);
			added++;
		}
		return added;
	}

	private AdminMenu save(Menu menu, String title, MenuForm form) {
		menu.setTitle(title);
		menu.setIntro(StringUtils.hasText(form.intro()) ? form.intro().strip() : null);
		menu.setPublished(form.published());
		menu.getRecipes().clear();
		menu.getRecipes().addAll(recipes(form.recipeIds()));
		return toAdmin(menuRepository.saveAndFlush(menu));
	}

	/** In the order given, each once. */
	private List<Recipe> recipes(Collection<Long> ids) {
		Map<Long, Recipe> byId = recipeRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Recipe::getId, Function.identity()));
		return ids.stream()
			.distinct()
			.map(id -> Optional.ofNullable(byId.get(id)).orElseThrow(() -> new ApiException(ErrorCode.MENU_RECIPE_NOT_FOUND)))
			.toList();
	}

	private MenuSummary summary(Menu menu, boolean publishedOnly) {
		List<Recipe> recipes = publishedOnly ? published(menu) : menu.getRecipes();
		return new MenuSummary(menu.getId(), menu.getTitle(), menu.getSlug(), menu.getIntro(), menu.isPublished(),
				recipes.size(), imageId(menu.getImage()), menu.getUpdatedAt());
	}

	private static @Nullable UUID imageId(@Nullable Image image) {
		return image == null ? null : image.getId();
	}

	private static List<Recipe> published(Menu menu) {
		return menu.getRecipes().stream().filter(recipe -> recipe.getStatus() == RecipeStatus.PUBLISHED).toList();
	}

	private static AdminMenu toAdmin(Menu menu) {
		return new AdminMenu(menu.getId(), menu.getTitle(), menu.getSlug(), menu.getIntro(), menu.isPublished(),
				imageId(menu.getImage()), menu.getRecipes()
					.stream()
					.map(recipe -> new MenuRecipe(recipe.getId(), recipe.getTitle(), recipe.getStatus()))
					.toList(),
				menu.getUpdatedAt());
	}

	private Menu find(long id) {
		return menuRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.MENU_NOT_FOUND));
	}

	private static String title(MenuForm form) {
		return Texts.capitalizeFirstLetter(form.title().strip());
	}

}
