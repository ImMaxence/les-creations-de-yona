package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
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
	}

	private Category find(long id) {
		return categoryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
	}

}
