package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

	private final CategoryRepository categoryRepository;

	private final RecipeRepository recipeRepository;

	private final CategoryMapper categoryMapper;

	private final ImageService imageService;

	private final TrashBin trashBin;

	public List<CategoryResponse> list() {
		return categoryRepository.findAll(Sort.by("name")).stream().map(categoryMapper::toResponse).toList();
	}

	@Transactional
	public CategoryResponse create(CategoryForm form) {
		Category category = new Category();
		category.setName(Texts.capitalizeFirstLetter(form.name().strip()));
		category.setSlug(Slugs.uniqueSlug(category.getName(), "categorie", categoryRepository::existsBySlug));
		return categoryMapper.toResponse(categoryRepository.save(category));
	}

	@Transactional
	public CategoryResponse rename(long id, CategoryForm form) {
		Category category = find(id);
		category.setName(Texts.capitalizeFirstLetter(form.name().strip()));
		return categoryMapper.toResponse(category);
	}

	/** Refused while it still contains recipes. Moved to the trash, kept 30 days; its photo stays in the gallery. */
	@Transactional
	public void delete(long id) {
		Category category = find(id);
		if (recipeRepository.existsByCategoriesId(id)) {
			throw new ApiException(ErrorCode.CATEGORY_IN_USE);
		}
		trash(List.of(category));
	}

	/** All or none: refused while one of them still contains recipes, naming those. Moved to the trash. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Category> categories = categoryRepository.findAllById(ids);
		if (categories.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.CATEGORY_NOT_FOUND);
		}
		List<String> inUse = categories.stream()
			.filter(category -> recipeRepository.existsByCategoriesId(category.getId()))
			.map(category -> "« " + category.getName() + " »")
			.toList();
		if (!inUse.isEmpty()) {
			throw new ApiException(ErrorCode.CATEGORY_IN_USE, "Suppression annulée : " + String.join(", ", inUse)
					+ (inUse.size() > 1 ? " contiennent" : " contient") + " encore des recettes.");
		}
		trash(categories);
	}

	/**
	 * Created again from the trash: same name, same URL if still free, its photo if still in the
	 * gallery and not shown by another category meanwhile. The recipes of the trash that were in it
	 * find it again by its URL.
	 */
	@Transactional
	public CategoryResponse restoreFromTrash(TrashItem trashed) {
		CategoryResponse kept = trashBin.content(trashed, CategoryResponse.class);
		Category category = new Category();
		category.setName(kept.name());
		category.setSlug(categoryRepository.existsBySlug(kept.slug())
				? Slugs.uniqueSlug(kept.name(), "categorie", categoryRepository::existsBySlug)
				: kept.slug());
		if (trashed.getImage() != null && !categoryRepository.existsByImageId(trashed.getImage().getId())) {
			category.setImage(trashed.getImage());
		}
		return categoryMapper.toResponse(categoryRepository.saveAndFlush(category));
	}

	/** "Modifier la photo": the new image is shown, the previous one stays in the gallery. */
	@Transactional
	public CategoryResponse replaceImage(long id, ProcessedImage processed) {
		Category category = find(id);
		category.setImage(imageService.create(ImageKind.CATEGORY, processed));
		return categoryMapper.toResponse(categoryRepository.saveAndFlush(category));
	}

	/** Shows an image of the gallery, or none (default visual). */
	@Transactional
	public CategoryResponse chooseImage(long id, @Nullable UUID imageId) {
		Category category = find(id);
		category.setImage(imageId == null ? null : imageService.getLandscape(imageId));
		return categoryMapper.toResponse(categoryRepository.saveAndFlush(category));
	}

	private void trash(List<Category> categories) {
		for (Category category : categories) {
			trashBin.put(TrashBin.Entry.of(TrashKind.CATEGORY, category.getName(), category.getSlug(), category.getImage(),
					categoryMapper.toResponse(category)));
		}
		categoryRepository.deleteAll(categories);
	}

	private Category find(long id) {
		return categoryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
	}

}
