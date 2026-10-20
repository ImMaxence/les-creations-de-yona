package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
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
		category.setName(form.name().strip());
		category.setSlug(Slugs.uniqueSlug(category.getName(), "categorie", categoryRepository::existsBySlug));
		return categoryMapper.toResponse(categoryRepository.save(category));
	}

	@Transactional
	public CategoryResponse rename(long id, CategoryForm form) {
		Category category = find(id);
		category.setName(form.name().strip());
		return categoryMapper.toResponse(category);
	}

	@Transactional
	public void delete(long id) {
		Category category = find(id);
		if (recipeRepository.existsByCategoryId(id)) {
			throw new ApiException(ErrorCode.CATEGORY_IN_USE);
		}
		categoryRepository.delete(category);
		if (category.getImage() != null) {
			imageService.delete(category.getImage());
		}
	}

	/** "Modifier la photo": the new image replaces the previous one, which is deleted. */
	@Transactional
	public CategoryResponse replaceImage(long id, ProcessedImage processed) {
		Category category = find(id);
		Image previous = category.getImage();
		category.setImage(imageService.create(ImageKind.CATEGORY, processed));
		if (previous != null) {
			imageService.delete(previous);
		}
		return categoryMapper.toResponse(categoryRepository.saveAndFlush(category));
	}

	private Category find(long id) {
		return categoryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
	}

}
