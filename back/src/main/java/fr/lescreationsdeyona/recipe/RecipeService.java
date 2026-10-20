package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeService {

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("title", "createdAt", "updatedAt");

	private static final int SUGGESTION_LIMIT = 5;

	private final RecipeRepository recipeRepository;

	private final CategoryRepository categoryRepository;

	private final IngredientService ingredientService;

	private final ImageService imageService;

	private final RecipeMapper recipeMapper;

	// Public site: published recipes only.

	public Page<RecipeCard> searchPublished(@Nullable String titleQuery, @Nullable String categorySlug,
			Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(titleQuery, categorySlug, RecipeStatus.PUBLISHED),
					Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES))
			.map(recipeMapper::toCard);
	}

	/** The featured recipe or, if none, the latest published one. */
	public Optional<RecipeCard> findFeatured() {
		return recipeRepository.findFirstByFeaturedTrue()
			.or(() -> recipeRepository.findFirstByStatusOrderByCreatedAtDesc(RecipeStatus.PUBLISHED))
			.map(recipeMapper::toCard);
	}

	public List<RecipeSuggestion> suggestTitles(String titleQuery) {
		return recipeRepository
			.findBy(RecipeSpecifications.matching(titleQuery, null, RecipeStatus.PUBLISHED),
					query -> query.sortBy(Sort.by("title")).limit(SUGGESTION_LIMIT).all())
			.stream()
			.map(recipeMapper::toSuggestion)
			.toList();
	}

	/** A draft is reported as not found, like a recipe that does not exist. */
	public RecipeDetail getPublished(String slug) {
		return recipeRepository.findBySlugAndStatus(slug, RecipeStatus.PUBLISHED)
			.map(recipeMapper::toDetail)
			.orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	// Back-office: every recipe, drafts included.

	public Page<RecipeAdminSummary> searchAll(@Nullable String titleQuery, @Nullable String categorySlug,
			@Nullable RecipeStatus status, Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(titleQuery, categorySlug, status),
					Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES))
			.map(recipeMapper::toAdminSummary);
	}

	public RecipeDetail get(long id) {
		return recipeMapper.toDetail(find(id));
	}

	@Transactional
	public RecipeDetail create(RecipeForm form) {
		Recipe recipe = new Recipe();
		recipe.setSlug(Slugs.uniqueSlug(form.title(), "recette", recipeRepository::existsBySlug));
		apply(form, recipe);
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	@Transactional
	public RecipeDetail update(long id, RecipeForm form) {
		Recipe recipe = find(id);
		apply(form, recipe);
		// Changing only ingredients or steps leaves the recipe row untouched, and auditing would then
		// skip updated_at: touching it makes every save count as an update.
		recipe.setUpdatedAt(Instant.now());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	@Transactional
	public void delete(long id) {
		Recipe recipe = find(id);
		recipeRepository.delete(recipe);
		if (recipe.getImage() != null) {
			imageService.delete(recipe.getImage());
		}
	}

	/** "Modifier la photo": the new image replaces the previous one, which is deleted. */
	@Transactional
	public RecipeDetail replaceImage(long id, ProcessedImage processed) {
		Recipe recipe = find(id);
		Image previous = recipe.getImage();
		recipe.setImage(imageService.create(ImageKind.RECIPE, processed));
		if (previous != null) {
			imageService.delete(previous);
		}
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	private Recipe find(long id) {
		return recipeRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	/** The slug is set at creation only: renaming a recipe keeps its URL. */
	private void apply(RecipeForm form, Recipe recipe) {
		if (form.featured()) {
			if (form.status() != RecipeStatus.PUBLISHED) {
				throw new ApiException(ErrorCode.FEATURED_RECIPE_MUST_BE_PUBLISHED);
			}
			// Done before changing the entity: the flush preceding this update must not write a second
			// featured recipe, which the database would reject.
			recipeRepository.unfeatureAllExcept(recipe.getId());
		}
		recipe.setTitle(form.title().strip());
		recipe.setIntro(form.intro());
		recipe.setStatus(form.status());
		recipe.setFeatured(form.featured());
		recipe.setCategory(categoryRepository.findById(form.categoryId())
			.orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND)));
		recipe.setServings(form.servings());
		recipe.setPrepMinutes(form.prepMinutes());
		recipe.setCookMinutes(form.cookMinutes());
		replaceIngredients(recipe, form.ingredients());
		recipe.getSteps().clear();
		form.steps().forEach(step -> recipe.getSteps().add(new RecipeStep(step.description(), step.durationMinutes())));
	}

	private void replaceIngredients(Recipe recipe, List<RecipeForm.IngredientLine> formLines) {
		// Lines already in the recipe are updated in place: removing then re-adding the same
		// (recipe, ingredient) key would fail, as Hibernate runs inserts before deletes.
		Map<Long, RecipeIngredient> previousLines = recipe.getIngredients()
			.stream()
			.collect(Collectors.toMap(line -> line.getIngredient().getId(), Function.identity()));
		Set<Long> seenIngredientIds = new HashSet<>();
		List<RecipeIngredient> lines = new ArrayList<>();
		for (int position = 0; position < formLines.size(); position++) {
			RecipeForm.IngredientLine formLine = formLines.get(position);
			Ingredient ingredient = ingredientService.findOrCreate(formLine.name());
			if (!seenIngredientIds.add(ingredient.getId())) {
				throw new ApiException(ErrorCode.DUPLICATE_RECIPE_INGREDIENT);
			}
			RecipeIngredient line = Optional.ofNullable(previousLines.get(ingredient.getId()))
				.orElseGet(() -> newLine(recipe, ingredient));
			line.setQuantity(formLine.quantity());
			line.setUnit(formLine.unit());
			line.setNote(formLine.note());
			line.setPosition(position);
			lines.add(line);
		}
		recipe.getIngredients().clear();
		recipe.getIngredients().addAll(lines);
	}

	private static RecipeIngredient newLine(Recipe recipe, Ingredient ingredient) {
		RecipeIngredient line = new RecipeIngredient();
		line.setRecipe(recipe);
		line.setIngredient(ingredient);
		return line;
	}

}
