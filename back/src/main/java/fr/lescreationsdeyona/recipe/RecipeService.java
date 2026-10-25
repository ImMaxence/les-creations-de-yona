package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.util.StringUtils;

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
			@Nullable String ingredientQuery, Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(titleQuery, categorySlug, ingredientQuery, null, RecipeStatus.PUBLISHED),
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
			.findBy(RecipeSpecifications.matching(titleQuery, null, null, null, RecipeStatus.PUBLISHED),
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
			@Nullable String ingredientQuery, @Nullable Long ingredientId, @Nullable RecipeStatus status,
			Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(titleQuery, categorySlug, ingredientQuery, ingredientId, status),
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

	/**
	 * The recipe as it would be saved from this form, for the preview of the back-office: same
	 * checks and same transformations (capital letter, video id, known ingredients), but nothing is
	 * written. {@code id} is null for a recipe not created yet.
	 */
	@Transactional
	public RecipeDetail preview(@Nullable Long id, RecipeForm form) {
		// Rolled back whatever happens: new ingredients and every change are discarded.
		TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
		Recipe recipe = id == null ? new Recipe() : find(id);
		if (id == null) {
			recipe.setSlug(Slugs.uniqueSlug(form.title(), "recette", recipeRepository::existsBySlug));
			recipe.setCreatedAt(Instant.now());
		}
		apply(form, recipe);
		recipe.setUpdatedAt(Instant.now());
		return recipeMapper.toDetail(recipe);
	}

	/** Its photo stays in the gallery. */
	@Transactional
	public void delete(long id) {
		recipeRepository.delete(find(id));
	}

	/** All or none: an unknown id cancels the whole deletion. Their photos stay in the gallery. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Recipe> recipes = recipeRepository.findAllById(ids);
		if (recipes.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.RECIPE_NOT_FOUND);
		}
		recipeRepository.deleteAll(recipes);
	}

	/** "Modifier la photo": the new image is shown, the previous one stays in the gallery. */
	@Transactional
	public RecipeDetail replaceImage(long id, ProcessedImage processed) {
		Recipe recipe = find(id);
		recipe.setImage(imageService.create(ImageKind.RECIPE, processed));
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** Shows an image of the gallery, or none (default visual). */
	@Transactional
	public RecipeDetail chooseImage(long id, @Nullable UUID imageId) {
		Recipe recipe = find(id);
		recipe.setImage(imageId == null ? null : imageService.get(imageId));
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	private Recipe find(long id) {
		return recipeRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	/** The slug is set at creation only: renaming a recipe keeps its URL. */
	private void apply(RecipeForm form, Recipe recipe) {
		// Read and checked before any change to the entity: the queries involved flush pending changes,
		// which must not include a half-applied form.
		List<Category> categories = categories(form.categoryIds());
		List<RecipePart> parts = parts(recipe, form.parts());
		if (form.featured()) {
			if (form.status() != RecipeStatus.PUBLISHED) {
				throw new ApiException(ErrorCode.FEATURED_RECIPE_MUST_BE_PUBLISHED);
			}
			// Done before changing the entity: the flush preceding this update must not write a second
			// featured recipe, which the database would reject.
			recipeRepository.unfeatureAllExcept(recipe.getId());
		}
		recipe.setTitle(Texts.capitalizeFirstLetter(form.title().strip()));
		recipe.setIntro(form.intro());
		recipe.setStatus(form.status());
		recipe.setFeatured(form.featured());
		recipe.getCategories().clear();
		recipe.getCategories().addAll(categories);
		recipe.setServings(form.servings());
		recipe.setPrepMinutes(form.prepMinutes());
		recipe.setCookMinutes(form.cookMinutes());
		recipe.setDifficulty(halfPoints(form.difficulty()));
		recipe.setYoutubeVideoId(youtubeVideoId(form.videoUrl()));
		// Parts are rewritten on each save. Hibernate inserts the new ones before deleting the previous
		// ones, which the deferred (recipe_id, position) constraint allows; their ingredient lines have
		// new keys, so they never collide with the previous ones.
		recipe.getParts().clear();
		recipe.getParts().addAll(parts);
	}

	/** In the order chosen: the first one is the main category, in the recipe URL. */
	private List<Category> categories(List<Long> categoryIds) {
		if (new HashSet<>(categoryIds).size() < categoryIds.size()) {
			throw new ApiException(ErrorCode.DUPLICATE_RECIPE_CATEGORY);
		}
		Map<Long, Category> categoriesById = categoryRepository.findAllById(categoryIds)
			.stream()
			.collect(Collectors.toMap(Category::getId, Function.identity()));
		return categoryIds.stream()
			.map(id -> Optional.ofNullable(categoriesById.get(id))
				.orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND)))
			.toList();
	}

	/**
	 * A single part may be untitled (a recipe without parts); several parts all need a title. Each
	 * part has an ingredient or a step at least, and the recipe at least one of each.
	 */
	private List<RecipePart> parts(Recipe recipe, List<RecipeForm.Part> formParts) {
		List<RecipePart> parts = new ArrayList<>();
		for (int position = 0; position < formParts.size(); position++) {
			RecipeForm.Part formPart = formParts.get(position);
			String title = StringUtils.hasText(formPart.title())
					? Texts.capitalizeFirstLetter(formPart.title().strip())
					: null;
			if (title == null && formParts.size() > 1) {
				throw new ApiException(ErrorCode.RECIPE_PART_TITLE_REQUIRED);
			}
			if (formPart.ingredients().isEmpty() && formPart.steps().isEmpty()) {
				throw new ApiException(ErrorCode.RECIPE_PART_EMPTY);
			}
			RecipePart part = new RecipePart();
			part.setRecipe(recipe);
			part.setPosition(position);
			part.setTitle(title);
			addIngredients(part, formPart.ingredients());
			formPart.steps().forEach(step -> part.getSteps().add(new RecipeStep(step.description(), step.durationMinutes())));
			parts.add(part);
		}
		if (parts.stream().allMatch(part -> part.getIngredients().isEmpty())) {
			throw new ApiException(ErrorCode.RECIPE_INGREDIENT_REQUIRED);
		}
		if (parts.stream().allMatch(part -> part.getSteps().isEmpty())) {
			throw new ApiException(ErrorCode.RECIPE_STEP_REQUIRED);
		}
		return parts;
	}

	/** The range is checked by the form; only half points are allowed in between (2.5, not 2.3). */
	private static @Nullable BigDecimal halfPoints(@Nullable BigDecimal difficulty) {
		if (difficulty == null) {
			return null;
		}
		if (difficulty.multiply(BigDecimal.TWO).stripTrailingZeros().scale() > 0) {
			throw new ApiException(ErrorCode.DIFFICULTY_NOT_HALF_POINT);
		}
		return difficulty;
	}

	private static @Nullable String youtubeVideoId(@Nullable String videoUrl) {
		if (videoUrl == null || videoUrl.isBlank()) {
			return null;
		}
		return YoutubeVideos.videoId(videoUrl).orElseThrow(() -> new ApiException(ErrorCode.VIDEO_URL_INVALID));
	}

	/** An ingredient appears once per part; another part of the recipe may list it again. */
	private void addIngredients(RecipePart part, List<RecipeForm.IngredientLine> formLines) {
		Set<Long> seenIngredientIds = new HashSet<>();
		for (int position = 0; position < formLines.size(); position++) {
			RecipeForm.IngredientLine formLine = formLines.get(position);
			Ingredient ingredient = ingredientService.findOrCreate(formLine.name());
			if (!seenIngredientIds.add(ingredient.getId())) {
				throw new ApiException(ErrorCode.DUPLICATE_RECIPE_INGREDIENT);
			}
			RecipeIngredient line = new RecipeIngredient();
			line.setPart(part);
			line.setIngredient(ingredient);
			line.setQuantity(formLine.quantity());
			line.setUnit(formLine.unit());
			line.setNote(formLine.note());
			line.setPosition(position);
			part.getIngredients().add(line);
		}
	}

}
