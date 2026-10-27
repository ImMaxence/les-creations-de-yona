package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.category.CategoryResponse;
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
import fr.lescreationsdeyona.tag.Tag;
import fr.lescreationsdeyona.tag.TagResponse;
import fr.lescreationsdeyona.tag.TagService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.util.StringUtils;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeService {

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("title", "createdAt", "updatedAt", "publishedAt");

	private static final int SUGGESTION_LIMIT = 5;

	private static final int RELATED_LIMIT = 3;

	private static final int TITLE_MAX_LENGTH = 150;

	private static final String COPY_SUFFIX = " (copie)";

	private final RecipeRepository recipeRepository;

	private final RecipeTrashRepository trashRepository;

	private final CategoryRepository categoryRepository;

	private final IngredientService ingredientService;

	private final ImageService imageService;

	private final TagService tagService;

	private final RecipeMapper recipeMapper;

	private final ApplicationEventPublisher events;

	private final AuditorAware<String> auditor;

	private final JsonMapper jsonMapper;

	// Public site: published recipes only.

	/** Published recipes only, whatever {@code filter.status()}; no back-office criteria. */
	public Page<RecipeCard> searchPublished(RecipeFilter filter, Pageable pageable) {
		RecipeFilter published = new RecipeFilter(filter.titleQuery(), filter.categorySlug(), filter.tagSlug(),
				filter.ingredientNames(), null, null, RecipeStatus.PUBLISHED, filter.maxMinutes(), filter.difficulty());
		return recipeRepository
			.findAll(RecipeSpecifications.matching(published), Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES))
			.map(recipeMapper::toCard);
	}

	/** The featured recipe or, if none, the latest published one. */
	public Optional<RecipeCard> findFeatured() {
		return recipeRepository.findFirstByFeaturedTrue()
			.or(() -> recipeRepository.findFirstByStatusOrderByPublishedAtDesc(RecipeStatus.PUBLISHED))
			.map(recipeMapper::toCard);
	}

	public List<RecipeSuggestion> suggestTitles(String titleQuery) {
		return recipeRepository
			.findBy(RecipeSpecifications.matching(RecipeFilter.publishedTitled(titleQuery)),
					query -> query.sortBy(Sort.by("title")).limit(SUGGESTION_LIMIT).all())
			.stream()
			.map(recipeMapper::toSuggestion)
			.toList();
	}

	/** A draft is reported as not found, like a recipe that does not exist. */
	public RecipeDetail getPublished(String slug) {
		return recipeMapper.toDetail(findPublished(slug));
	}

	/** "Vous aimerez aussi": 3 published recipes sharing its tags or categories, else the latest. */
	public List<RecipeCard> related(String slug) {
		List<Long> ids = recipeRepository.findRelatedIds(findPublished(slug).getId(), RELATED_LIMIT);
		Map<Long, Recipe> recipesById = recipeRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Recipe::getId, Function.identity()));
		return ids.stream().map(recipesById::get).filter(Objects::nonNull).map(recipeMapper::toCard).toList();
	}

	private Recipe findPublished(String slug) {
		return recipeRepository.findBySlugAndStatus(slug, RecipeStatus.PUBLISHED)
			.orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	// Back-office: every recipe, drafts included.

	public Page<RecipeAdminSummary> searchAll(RecipeFilter filter, Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(filter), Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES))
			.map(recipeMapper::toAdminSummary);
	}

	public RecipeDetail get(long id) {
		return recipeMapper.toDetail(find(id));
	}

	@Transactional
	public RecipeDetail create(RecipeForm form) {
		Recipe recipe = new Recipe();
		recipe.setSlug(Slugs.uniqueSlug(form.title(), "recette", recipeRepository::existsBySlug));
		boolean firstPublication = apply(form, recipe);
		return saveAndAnnounce(recipe, firstPublication);
	}

	@Transactional
	public RecipeDetail update(long id, RecipeForm form) {
		Recipe recipe = find(id);
		boolean firstPublication = apply(form, recipe);
		// Changing only ingredients or steps leaves the recipe row untouched, and auditing would then
		// skip updated_at: touching it makes every save count as an update.
		recipe.setUpdatedAt(Instant.now());
		return saveAndAnnounce(recipe, firstPublication);
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

	/**
	 * "Dupliquer": a new draft with the same content, photos, categories and tags, titled
	 * "… (copie)", never featured nor scheduled.
	 */
	@Transactional
	public RecipeDetail duplicate(long id) {
		Recipe source = find(id);
		RecipeDetail detail = recipeMapper.toDetail(source);
		String title = source.getTitle().length() + COPY_SUFFIX.length() > TITLE_MAX_LENGTH
				? source.getTitle().substring(0, TITLE_MAX_LENGTH - COPY_SUFFIX.length()) + COPY_SUFFIX
				: source.getTitle() + COPY_SUFFIX;
		Recipe copy = new Recipe();
		copy.setSlug(Slugs.uniqueSlug(title, "recette", recipeRepository::existsBySlug));
		apply(formOf(detail, title, RecipeStatus.DRAFT, ids(detail.categories(), CategoryResponse::id),
				ids(detail.tags(), TagResponse::id)), copy);
		copy.setImage(source.getImage());
		copy.setPinterestImage(source.getPinterestImage());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(copy));
	}

	/** Moved to the trash, kept 30 days; its photo stays in the gallery. */
	@Transactional
	public void delete(long id) {
		trash(List.of(find(id)));
	}

	/** All or none: an unknown id cancels the whole deletion. Moved to the trash, photos kept. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Recipe> recipes = recipeRepository.findAllById(ids);
		if (recipes.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.RECIPE_NOT_FOUND);
		}
		trash(recipes);
	}

	/**
	 * Created again from the trash, as it was: same URL if still free, same dates, its photos if
	 * still in the gallery, its categories and tags that still exist. Never featured again, and no
	 * notification: it was already published.
	 */
	@Transactional
	public RecipeDetail restoreFromTrash(long trashId) {
		RecipeTrash trashed = trashRepository.findById(trashId)
			.orElseThrow(() -> new ApiException(ErrorCode.TRASHED_RECIPE_NOT_FOUND));
		RecipeDetail kept = jsonMapper.readValue(trashed.getContent(), RecipeDetail.class);
		List<Long> categoryIds = ids(kept.categories(), CategoryResponse::id).stream()
			.filter(categoryRepository::existsById)
			.toList();
		if (categoryIds.isEmpty()) {
			throw new ApiException(ErrorCode.TRASHED_RECIPE_CATEGORIES_GONE);
		}
		List<Long> tagIds = tagService.existingIds(ids(kept.tags(), TagResponse::id));
		Recipe recipe = new Recipe();
		recipe.setSlug(recipeRepository.existsBySlug(trashed.getSlug())
				? Slugs.uniqueSlug(kept.title(), "recette", recipeRepository::existsBySlug)
				: trashed.getSlug());
		apply(formOf(kept, kept.title(), kept.status(), categoryIds, tagIds), recipe);
		recipe.setImage(trashed.getImage());
		recipe.setPinterestImage(trashed.getPinterestImage());
		long id = recipeRepository.saveAndFlush(recipe).getId();
		trashRepository.delete(trashed);
		recipeRepository.restoreDates(id, kept.createdAt(), kept.publishedAt() != null || kept.status() != RecipeStatus.PUBLISHED
				? kept.publishedAt()
				: Instant.now());
		return get(id);
	}

	/** Drafts whose scheduled time has come, the earliest first. */
	public List<Long> dueForPublication(Instant now) {
		return recipeRepository.findScheduledBefore(now);
	}

	/** Publishes a draft at its scheduled time; does nothing if it was published or rescheduled meanwhile. */
	@Transactional
	public void publishScheduled(long id, Instant now) {
		Recipe recipe = recipeRepository.findById(id).orElse(null);
		if (recipe == null || recipe.getStatus() != RecipeStatus.DRAFT || recipe.getScheduledAt() == null
				|| recipe.getScheduledAt().isAfter(now)) {
			return;
		}
		boolean firstPublication = recipe.getPublishedAt() == null;
		recipe.setStatus(RecipeStatus.PUBLISHED);
		recipe.setScheduledAt(null);
		if (firstPublication) {
			recipe.setPublishedAt(now);
		}
		recipe.setUpdatedAt(now);
		saveAndAnnounce(recipe, firstPublication);
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
		recipe.setImage(imageId == null ? null : imageService.getLandscape(imageId));
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** The vertical photo offered to Pinterest; the previous one stays in the gallery. */
	@Transactional
	public RecipeDetail replacePinterestImage(long id, ProcessedImage processed) {
		Recipe recipe = find(id);
		recipe.setPinterestImage(imageService.create(ImageKind.PINTEREST, processed));
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** A vertical photo of the gallery, or none: Pinterest is then offered the main photo. */
	@Transactional
	public RecipeDetail choosePinterestImage(long id, @Nullable UUID imageId) {
		Recipe recipe = find(id);
		recipe.setPinterestImage(imageId == null ? null : imageService.getPortrait(imageId));
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	private Recipe find(long id) {
		return recipeRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	/** Subscribers are notified once the transaction is committed (see RecipePublished). */
	private RecipeDetail saveAndAnnounce(Recipe recipe, boolean firstPublication) {
		Recipe saved = recipeRepository.saveAndFlush(recipe);
		if (firstPublication) {
			events.publishEvent(RecipePublished.of(saved));
		}
		return recipeMapper.toDetail(saved);
	}

	/** The recipe as the back-office edits it, in JSON: everything needed to create it again. */
	private void trash(List<Recipe> recipes) {
		Instant now = Instant.now();
		String deletedBy = auditor.getCurrentAuditor().orElse("");
		for (Recipe recipe : recipes) {
			RecipeTrash trashed = new RecipeTrash();
			trashed.setTitle(recipe.getTitle());
			trashed.setSlug(recipe.getSlug());
			trashed.setStatus(recipe.getStatus());
			trashed.setImage(recipe.getImage());
			trashed.setPinterestImage(recipe.getPinterestImage());
			trashed.setContent(jsonMapper.writeValueAsString(recipeMapper.toDetail(recipe)));
			trashed.setDeletedAt(now);
			trashed.setDeletedBy(deletedBy);
			trashRepository.save(trashed);
		}
		recipeRepository.deleteAll(recipes);
	}

	/**
	 * The slug is set at creation only: renaming a recipe keeps its URL. Returns whether the recipe
	 * is published for the first time.
	 */
	private boolean apply(RecipeForm form, Recipe recipe) {
		// Read and checked before any change to the entity: the queries involved flush pending changes,
		// which must not include a half-applied form.
		List<Category> categories = categories(form.categoryIds());
		List<Tag> tags = form.tagIds() == null ? List.of() : tagService.findAll(form.tagIds());
		List<RecipePart> parts = parts(recipe, form.parts());
		checkMold(form.mold());
		Instant scheduledAt = form.scheduledAt();
		if (scheduledAt != null) {
			if (form.status() != RecipeStatus.DRAFT) {
				throw new ApiException(ErrorCode.SCHEDULED_RECIPE_MUST_BE_DRAFT);
			}
			// The time kept unchanged may have just passed: the scheduler publishes it within a minute
			if (scheduledAt.isBefore(Instant.now()) && !scheduledAt.equals(recipe.getScheduledAt())) {
				throw new ApiException(ErrorCode.SCHEDULED_AT_PAST);
			}
		}
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
		recipe.setScheduledAt(scheduledAt);
		recipe.getCategories().clear();
		recipe.getCategories().addAll(categories);
		recipe.getTags().clear();
		recipe.getTags().addAll(tags);
		recipe.setServings(form.servings());
		recipe.setPrepMinutes(form.prepMinutes());
		recipe.setCookMinutes(form.cookMinutes());
		recipe.setRestMinutes(form.restMinutes());
		recipe.setDifficulty(halfPoints(form.difficulty()));
		recipe.setYoutubeVideoId(youtubeVideoId(form.videoUrl()));
		recipe.setTip(StringUtils.hasText(form.tip()) ? form.tip().strip() : null);
		recipe.setEquipment(equipment(form.equipment()));
		RecipeForm.Mold mold = form.mold();
		recipe.setMoldShape(mold == null ? null : mold.shape());
		recipe.setMoldLengthCm(mold == null ? null : mold.lengthCm());
		recipe.setMoldWidthCm(mold == null ? null : mold.widthCm());
		// Parts are rewritten on each save. Hibernate inserts the new ones before deleting the previous
		// ones, which the deferred (recipe_id, position) constraint allows; their ingredient lines have
		// new keys, so they never collide with the previous ones.
		recipe.getParts().clear();
		recipe.getParts().addAll(parts);
		boolean firstPublication = form.status() == RecipeStatus.PUBLISHED && recipe.getPublishedAt() == null;
		if (firstPublication) {
			recipe.setPublishedAt(Instant.now());
		}
		return firstPublication;
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
			int ingredientCount = part.getIngredients().size();
			formPart.steps().forEach(step -> part.getSteps().add(new RecipeStep(step.description(), step.durationMinutes(),
					ingredientPositions(step.ingredientPositions(), ingredientCount))));
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

	/** Each once, in the order of the ingredient list; all of them within the part's list. */
	private static List<Integer> ingredientPositions(List<Integer> positions, int ingredientCount) {
		if (positions.stream().anyMatch(position -> position >= ingredientCount)) {
			throw new ApiException(ErrorCode.STEP_INGREDIENT_INVALID);
		}
		return List.copyOf(new TreeSet<>(positions));
	}

	/** A width for a rectangle, and for a rectangle only. */
	private static void checkMold(RecipeForm.@Nullable Mold mold) {
		if (mold != null && (mold.shape() == MoldShape.RECTANGLE) != (mold.widthCm() != null)) {
			throw new ApiException(ErrorCode.MOLD_INVALID);
		}
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

	/** One item per line, trimmed, each once (case ignored); null for none. */
	static @Nullable String equipment(@Nullable List<String> items) {
		if (items == null) {
			return null;
		}
		Map<String, String> byKey = new LinkedHashMap<>();
		for (String item : items) {
			String line = item.replaceAll("\\s+", " ").strip();
			if (!line.isEmpty()) {
				byKey.putIfAbsent(line.toLowerCase(Locale.ROOT), Texts.capitalizeFirstLetter(line));
			}
		}
		return byKey.isEmpty() ? null : String.join("\n", byKey.values());
	}

	/** The form that would save {@code recipe} again: duplicate, restore from the trash. */
	private static RecipeForm formOf(RecipeDetail recipe, String title, RecipeStatus status, List<Long> categoryIds,
			List<Long> tagIds) {
		RecipeDetail.Mold mold = recipe.mold();
		return new RecipeForm(title, recipe.intro(), status, false, categoryIds, tagIds, recipe.servings(),
				recipe.prepMinutes(), recipe.cookMinutes(), recipe.restMinutes(), recipe.difficulty(),
				recipe.youtubeVideoId() == null ? null : "https://www.youtube.com/watch?v=" + recipe.youtubeVideoId(),
				recipe.tip(), recipe.equipment(), mold == null ? null : new RecipeForm.Mold(mold.shape(), mold.lengthCm(), mold.widthCm()),
				null,
				recipe.parts().stream().map(part -> new RecipeForm.Part(part.title(),
						part.ingredients().stream()
							.map(line -> new RecipeForm.IngredientLine(line.name(), line.quantity(), line.unit(), line.note()))
							.toList(),
						part.steps().stream()
							.map(step -> new RecipeForm.Step(step.description(), step.durationMinutes(),
									step.ingredientPositions() == null ? List.of() : step.ingredientPositions()))
							.toList()))
					.toList());
	}

	private static <T> List<Long> ids(List<T> items, Function<T, Long> id) {
		return items.stream().map(id).toList();
	}

}
