package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.recipe.RecipeRepository;
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

	/** Refused while it still contains recipes. Its photo stays in the gallery. */
	@Transactional
	public void delete(long id) {
		Category category = find(id);
		if (recipeRepository.existsByCategoriesId(id)) {
			throw new ApiException(ErrorCode.CATEGORY_IN_USE);
		}
		categoryRepository.delete(category);
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
		category.setImage(imageId == null ? null : imageService.get(imageId));
		return categoryMapper.toResponse(categoryRepository.saveAndFlush(category));
	}

	private Category find(long id) {
		return categoryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
	}

}
