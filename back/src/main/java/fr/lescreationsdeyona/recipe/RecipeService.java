package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.nutrition.NutritionService;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import fr.lescreationsdeyona.shop.ShopProductRepository;
import fr.lescreationsdeyona.tag.Tag;
import fr.lescreationsdeyona.tag.TagResponse;
import fr.lescreationsdeyona.tag.TagService;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.math.BigDecimal;
import java.time.Duration;
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
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
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

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("title", "createdAt", "updatedAt", "publishedAt");

	/** The back-office list also sorts by views, and by id to keep equal titles or counts in a stable order. */
	private static final Set<String> ADMIN_SORTABLE_PROPERTIES = Set.of("title", "createdAt", "updatedAt", "publishedAt",
			"viewCount", "id");

	private static final int SUGGESTION_LIMIT = 5;

	private static final int RELATED_LIMIT = 3;

	private static final int TITLE_MAX_LENGTH = 150;

	private static final String COPY_SUFFIX = " (copie)";

	/**
	 * A scheduled publication later than this is not done: the site was down at that time, or a
	 * backup older than it was restored. A redeployment takes a few minutes and passes.
	 */
	static final Duration LATE_LIMIT = Duration.ofMinutes(30);

	static final String LATE_FAILURE = "Le site était arrêté à l'heure prévue : plus de 30 minutes de retard, la recette n'a pas été publiée";

	private final RecipeRepository recipeRepository;

	private final CategoryRepository categoryRepository;

	private final IngredientService ingredientService;

	private final ImageService imageService;

	private final TagService tagService;

	private final MenuService menuService;

	private final TrashBin trashBin;

	private final RecipeMapper recipeMapper;

	private final ApplicationEventPublisher events;

	private final AuditLog auditLog;

	private final ShopProductRepository shopProductRepository;

	private final NutritionService nutritionService;

	// Public site: published recipes only.

	/** Published recipes only, whatever {@code filter.status()}; no back-office criteria. */
	@Cacheable(PublicCache.RECIPES)
	public Page<RecipeCard> searchPublished(RecipeFilter filter, Pageable pageable) {
		RecipeFilter published = new RecipeFilter(null, filter.text(), filter.categorySlug(), filter.tagSlug(),
				filter.ingredientNames(), null, null, RecipeStatus.PUBLISHED, filter.theme(), filter.maxMinutes(),
				filter.difficulty());
		return recipeRepository
			.findAll(RecipeSpecifications.matching(published), Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES))
			.map(recipeMapper::toCard);
	}

	/**
	 * The featured recipe or, if none, the latest published one. With a theme (applications installed
	 * before 1.12): the featured recipe if of that theme, otherwise its latest published one.
	 */
	@Cacheable(PublicCache.FEATURED_RECIPE)
	public Optional<RecipeCard> findFeatured(@Nullable RecipeTheme theme) {
		Optional<Recipe> featured = theme == null
				? recipeRepository.findFirstByFeaturedTrueAndStatus(RecipeStatus.PUBLISHED)
					.or(() -> recipeRepository.findFirstByStatusOrderByPublishedAtDesc(RecipeStatus.PUBLISHED))
				: recipeRepository.findFirstByFeaturedTrueAndStatusAndTheme(RecipeStatus.PUBLISHED, theme)
					.or(() -> recipeRepository.findFirstByStatusAndThemeOrderByPublishedAtDesc(RecipeStatus.PUBLISHED, theme));
		return featured.map(recipeMapper::toCard);
	}

	/** Published recipes mentioning each word typed (title, category, tag, ingredient), by title. */
	public List<RecipeSuggestion> suggest(String text) {
		return recipeRepository
			.findBy(RecipeSpecifications.matching(RecipeFilter.publishedText(text)),
					query -> query.sortBy(Sort.by("title")).limit(SUGGESTION_LIMIT).all())
			.stream()
			.map(recipeMapper::toSuggestion)
			.toList();
	}

	/** A draft is reported as not found, like a recipe that does not exist. */
	@Cacheable(PublicCache.RECIPE)
	public RecipeDetail getPublished(String slug) {
		return shown(findPublished(slug));
	}

	/** As visitors read it: the recipes it uses as parts unfolded, quantities multiplied. */
	private RecipeDetail unfolded(Recipe recipe) {
		return LinkedRecipes.unfold(recipe, recipeMapper.toDetail(recipe), recipeMapper);
	}

	/**
	 * Unfolded, with its nutrition facts when its page shows them and they are complete (every ingredient has its
	 * facts): half of them would be wrong, they wait until the admin completes them (Statistiques lists the recipe).
	 */
	private RecipeDetail shown(Recipe recipe) {
		RecipeDetail detail = unfolded(recipe);
		if (!detail.showsNutrition()) {
			return detail;
		}
		RecipeNutrition nutrition = nutritionOf(detail, BigDecimal.ONE, detail.servings());
		return nutrition.complete() ? RecipeDetail.withNutrition(detail, nutrition) : detail;
	}

	/** The recipes showing their nutrition facts whose facts are not complete yet, hidden from their page meanwhile. */
	public Set<Long> withIncompleteNutrition() {
		Set<Long> ids = new HashSet<>();
		for (Recipe recipe : recipeRepository.findByShowNutritionTrue()) {
			RecipeDetail detail = unfolded(recipe);
			if (!nutritionOf(detail, BigDecimal.ONE, detail.servings()).complete()) {
				ids.add(recipe.getId());
			}
		}
		return ids;
	}

	/** Its unfolded lines, quantities times {@code ratio}, added up. */
	private RecipeNutrition nutritionOf(RecipeDetail unfolded, BigDecimal ratio, @Nullable Integer servings) {
		return nutritionService.compute(nutritionLines(unfolded, ratio), servings);
	}

	private static List<NutritionService.Line> nutritionLines(RecipeDetail unfolded, BigDecimal ratio) {
		return unfolded.parts()
			.stream()
			.flatMap(part -> part.ingredients().stream())
			.map(line -> new NutritionService.Line(line.name(), line.quantity() == null ? null : line.quantity().multiply(ratio),
					line.unit()))
			.toList();
	}

	/**
	 * The nutrition facts of the recipe being written in the editor, saved or not: its lines, and the recipes it
	 * uses as parts, as saved.
	 */
	public RecipeNutrition estimateNutrition(NutritionEstimateForm form) {
		List<NutritionService.Line> lines = new ArrayList<>();
		for (NutritionEstimateForm.Part part : form.parts()) {
			if (part.linkedRecipeId() != null) {
				BigDecimal ratio = part.linkedRatio() == null ? BigDecimal.ONE : part.linkedRatio();
				lines.addAll(nutritionLines(unfolded(find(part.linkedRecipeId())), ratio));
			}
			else {
				part.ingredients()
					.stream()
					.filter(line -> StringUtils.hasText(line.name()))
					.forEach(line -> lines.add(new NutritionService.Line(line.name().strip(), line.quantity(), line.unit())));
			}
		}
		return nutritionService.compute(lines, form.servings());
	}

	/** "Vous aimerez aussi": 3 published recipes sharing its tags or categories, else the latest. */
	@Cacheable(PublicCache.RELATED_RECIPES)
	public List<RecipeCard> related(String slug) {
		List<Long> ids = recipeRepository.findRelatedIds(findPublished(slug).getId(), RELATED_LIMIT);
		Map<Long, Recipe> recipesById = recipeRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Recipe::getId, Function.identity()));
		return ids.stream().map(recipesById::get).filter(Objects::nonNull).map(recipeMapper::toCard).toList();
	}

	/**
	 * A visit of a published recipe page, sent once per visit by the browser; nothing about the
	 * visitor is kept. Does nothing for a draft or an unknown slug. Written without the entity, so
	 * that updated_at stays the date of the last change made by the admin.
	 */
	@Transactional
	public void recordView(String slug) {
		recipeRepository.incrementViewCount(slug);
	}

	private Recipe findPublished(String slug) {
		return recipeRepository.findBySlugAndStatus(slug, RecipeStatus.PUBLISHED)
			.orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	// Back-office: every recipe, drafts included.

	public Page<RecipeAdminSummary> searchAll(RecipeFilter filter, Pageable pageable) {
		return recipeRepository
			.findAll(RecipeSpecifications.matching(filter), Pageables.requireSortedOn(pageable, ADMIN_SORTABLE_PROPERTIES))
			.map(recipeMapper::toAdminSummary);
	}

	public RecipeDetail get(long id) {
		return recipeMapper.toDetail(find(id));
	}

	/** A recipe as visitors would read it, for "Aperçu": drafts too. */
	public RecipeDetail getUnfolded(long id) {
		return shown(find(id));
	}

	@Transactional
	public RecipeDetail create(RecipeForm form) {
		Recipe recipe = new Recipe();
		recipe.setSlug(Slugs.uniqueSlug(form.title(), "recette", recipeRepository::existsBySlug));
		boolean firstPublication = apply(form, recipe);
		RecipeDetail created = saveAndAnnounce(recipe, firstPublication);
		pagesChanged(Stream.of(publicPath(recipe)));
		auditLog.record(AuditAction.CREATED, AuditKind.RECIPE, created.title(), created.id());
		return created;
	}

	@Transactional
	public RecipeDetail update(long id, RecipeForm form) {
		Recipe recipe = find(id);
		RecipeDetail before = recipeMapper.toDetail(recipe);
		// Unpublished, or moved to another main category: the previous address changes too
		String pathBefore = publicPath(recipe);
		boolean firstPublication = apply(form, recipe);
		// Changing only ingredients or steps leaves the recipe row untouched, and auditing would then
		// skip updated_at: touching it makes every save count as an update.
		recipe.setUpdatedAt(Instant.now());
		RecipeDetail updated = saveAndAnnounce(recipe, firstPublication);
		pagesChanged(Stream.of(pathBefore, publicPath(recipe)));
		auditLog.record(AuditAction.UPDATED, AuditKind.RECIPE, recipe.getTitle(), id, RecipeChanges.between(before, updated));
		return updated;
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
		return shown(recipe);
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
		apply(formOf(detail, title, RecipeStatus.DRAFT, detail.theme(), ids(detail.categories(), CategoryResponse::id),
				ids(detail.tags(), TagResponse::id), RecipeDetail.LinkedRecipe::id), copy);
		copy.setImage(source.getImage());
		copy.setPinterestImage(source.getPinterestImage());
		Recipe saved = recipeRepository.saveAndFlush(copy);
		auditLog.record(AuditAction.CREATED, AuditKind.RECIPE, saved.getTitle(), saved.getId());
		return recipeMapper.toDetail(saved);
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
	 * Created again from the trash, as it was: same URL if still free, same dates and views, its
	 * photos if still in the gallery, its categories and tags that still exist (a category or a tag
	 * deleted then restored meanwhile is found by its URL). Never featured again, and no notification: it
	 * was already published. A failed one comes back as a draft, a recipe trashed before the themes as
	 * sweet. Its menus are given back by {@link MenuService#addBack}.
	 */
	@Transactional
	public RecipeDetail restoreFromTrash(TrashItem trashed) {
		RecipeDetail kept = trashBin.content(trashed, RecipeDetail.class);
		List<Long> categoryIds = kept.categories().stream()
			.map(category -> categoryRepository.existsById(category.id()) ? Optional.of(category.id())
					: categoryRepository.findBySlug(category.slug()).map(Category::getId))
			.flatMap(Optional::stream)
			.distinct()
			.toList();
		if (categoryIds.isEmpty()) {
			throw new ApiException(ErrorCode.TRASHED_RECIPE_CATEGORIES_GONE);
		}
		List<Long> tagIds = tagService.stillExisting(kept.tags());
		Recipe recipe = new Recipe();
		recipe.setSlug(recipeRepository.existsBySlug(trashed.getSlug())
				? Slugs.uniqueSlug(kept.title(), "recette", recipeRepository::existsBySlug)
				: trashed.getSlug());
		RecipeStatus status = kept.status() == RecipeStatus.FAILED ? RecipeStatus.DRAFT : kept.status();
		apply(formOf(kept, kept.title(), status, kept.theme() == null ? RecipeTheme.SWEET : kept.theme(), categoryIds,
				tagIds, this::stillLinkable), recipe);
		recipe.setImage(trashed.getImage());
		recipe.setPinterestImage(trashed.getPinterestImage());
		long id = recipeRepository.saveAndFlush(recipe).getId();
		pagesChanged(Stream.of(publicPath(recipe)));
		recipeRepository.restoreDates(id, kept.createdAt(), kept.publishedAt() != null || status != RecipeStatus.PUBLISHED
				? kept.publishedAt()
				: Instant.now(), trashed.getViewCount() == null ? 0 : trashed.getViewCount());
		return get(id);
	}

	/** The recipe a trashed one used: itself, or by its URL once restored meanwhile with a new id. */
	private Long stillLinkable(RecipeDetail.LinkedRecipe linked) {
		if (recipeRepository.existsById(linked.id())) {
			return linked.id();
		}
		return recipeRepository.findBySlug(linked.slug())
			.map(Recipe::getId)
			.orElseThrow(() -> new ApiException(ErrorCode.TRASHED_RECIPE_LINK_GONE,
					"Cette recette utilise « " + linked.title() + " », qui n'existe plus : restaurez-la d'abord"));
	}

	/** Drafts whose scheduled time has come, the earliest first. */
	public List<Long> dueForPublication(Instant now) {
		return recipeRepository.findScheduledBefore(now);
	}

	/**
	 * Publishes a draft at its scheduled time; does nothing if it was published or rescheduled
	 * meanwhile. More than {@link #LATE_LIMIT} late, it fails instead: the site was down then.
	 */
	@Transactional
	public void publishScheduled(long id, Instant now) {
		Recipe recipe = recipeRepository.findById(id).orElse(null);
		if (recipe == null || recipe.getStatus() != RecipeStatus.DRAFT || recipe.getScheduledAt() == null
				|| recipe.getScheduledAt().isAfter(now)) {
			return;
		}
		if (recipe.getScheduledAt().isBefore(now.minus(LATE_LIMIT))) {
			fail(recipe, LATE_FAILURE);
			return;
		}
		String unpublished = unpublishedLink(recipe.getParts());
		if (unpublished != null) {
			fail(recipe, unpublishedLinkMessage(unpublished));
			return;
		}
		publish(recipe, now);
		auditLog.record(AuditAction.PUBLISHED, AuditKind.RECIPE, recipe.getTitle(), id);
	}

	/** A scheduled publication that kept failing: the recipe stays unpublished, with the reason. */
	@Transactional
	public void failScheduled(long id, String reason) {
		recipeRepository.findById(id)
			.filter(recipe -> recipe.getStatus() == RecipeStatus.DRAFT && recipe.getScheduledAt() != null)
			.ifPresent(recipe -> fail(recipe, reason));
	}

	/**
	 * "Publier maintenant": a draft or a failed recipe published at once, its schedule dropped.
	 * Featured ahead, it becomes the featured recipe. Nothing changes for a recipe
	 * already published.
	 */
	@Transactional
	public RecipeDetail publishNow(long id) {
		Recipe recipe = find(id);
		if (recipe.getStatus() == RecipeStatus.PUBLISHED) {
			return recipeMapper.toDetail(recipe);
		}
		String unpublished = unpublishedLink(recipe.getParts());
		if (unpublished != null) {
			throw new ApiException(ErrorCode.RECIPE_LINK_NOT_PUBLISHED, unpublishedLinkMessage(unpublished));
		}
		RecipeDetail published = publish(recipe, Instant.now());
		auditLog.record(AuditAction.PUBLISHED, AuditKind.RECIPE, recipe.getTitle(), id);
		return published;
	}

	private RecipeDetail publish(Recipe recipe, Instant now) {
		if (recipe.isFeatured()) {
			// Before the status changes: the flush preceding this update must not write a second featured recipe
			recipeRepository.unfeatureAllExcept(recipe.getId());
		}
		boolean firstPublication = recipe.getPublishedAt() == null;
		recipe.setStatus(RecipeStatus.PUBLISHED);
		recipe.setScheduledAt(null);
		recipe.setPublicationFailure(null);
		if (firstPublication) {
			recipe.setPublishedAt(now);
		}
		recipe.setUpdatedAt(now);
		RecipeDetail published = saveAndAnnounce(recipe, firstPublication);
		pagesChanged(Stream.of(publicPath(recipe)));
		return published;
	}

	private void fail(Recipe recipe, String reason) {
		recipe.setStatus(RecipeStatus.FAILED);
		recipe.setPublicationFailure(reason);
		recipeRepository.saveAndFlush(recipe);
		auditLog.record(AuditAction.PUBLICATION_FAILED, AuditKind.RECIPE, recipe.getTitle(), recipe.getId());
	}

	/** "Modifier la photo": the new image is shown, the previous one stays in the gallery. */
	@Transactional
	public RecipeDetail replaceImage(long id, ProcessedImage processed) {
		Recipe recipe = find(id);
		Image before = recipe.getImage();
		recipe.setImage(imageService.create(ImageKind.RECIPE, processed));
		recordPhoto(recipe, "Photo", before, recipe.getImage());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** Shows an image of the gallery, or none (default visual). */
	@Transactional
	public RecipeDetail chooseImage(long id, @Nullable UUID imageId) {
		Recipe recipe = find(id);
		Image before = recipe.getImage();
		recipe.setImage(imageId == null ? null : imageService.getLandscape(imageId));
		recordPhoto(recipe, "Photo", before, recipe.getImage());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** The vertical photo offered to Pinterest; the previous one stays in the gallery. */
	@Transactional
	public RecipeDetail replacePinterestImage(long id, ProcessedImage processed) {
		Recipe recipe = find(id);
		Image before = recipe.getPinterestImage();
		recipe.setPinterestImage(imageService.create(ImageKind.PINTEREST, processed));
		recordPhoto(recipe, "Photo Pinterest", before, recipe.getPinterestImage());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	/** A vertical photo of the gallery, or none: Pinterest is then offered the main photo. */
	@Transactional
	public RecipeDetail choosePinterestImage(long id, @Nullable UUID imageId) {
		Recipe recipe = find(id);
		Image before = recipe.getPinterestImage();
		recipe.setPinterestImage(imageId == null ? null : imageService.getPortrait(imageId));
		recordPhoto(recipe, "Photo Pinterest", before, recipe.getPinterestImage());
		return recipeMapper.toDetail(recipeRepository.saveAndFlush(recipe));
	}

	private Recipe find(long id) {
		return recipeRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
	}

	/** A photo is told apart by the time it was added to the gallery. */
	private void recordPhoto(Recipe recipe, String field, @Nullable Image before, @Nullable Image after) {
		auditLog.record(AuditAction.UPDATED, AuditKind.RECIPE, recipe.getTitle(), recipe.getId(),
				new AuditChanges().add(field, photo(before), photo(after)));
	}

	private static @Nullable String photo(@Nullable Image image) {
		if (image == null) {
			return null;
		}
		return image.getCreatedAt() == null ? "Nouvelle photo" : "Photo ajoutée le " + AuditChanges.dateTime(image.getCreatedAt());
	}

	/** Subscribers are notified once the transaction is committed (see RecipePublished). */
	private RecipeDetail saveAndAnnounce(Recipe recipe, boolean firstPublication) {
		Recipe saved = recipeRepository.saveAndFlush(recipe);
		if (firstPublication) {
			events.publishEvent(RecipePublished.of(saved));
		}
		return recipeMapper.toDetail(saved);
	}

	/**
	 * The recipe as the back-office edits it, in JSON: everything needed to create it again, with
	 * its views and the menus it leaves.
	 */
	private void trash(List<Recipe> recipes) {
		checkFreeToDelete(recipes);
		for (Recipe recipe : recipes) {
			trashBin.put(new TrashBin.Entry(TrashKind.RECIPE, recipe.getTitle(), recipe.getSlug(), recipe.getStatus(),
					recipe.getImage(), recipe.getPinterestImage(), recipeMapper.toDetail(recipe),
					new RecipeLinks(menuService.placesOf(recipe.getId())),
					recipe.getViewCount()));
		}
		pagesChanged(recipes.stream().map(RecipeService::publicPath));
		recipeRepository.deleteAll(recipes);
	}

	/**
	 * Refused while another recipe uses one of them (unless going with it), or while one of them is offered
	 * in the shop: the admin takes it out of there first.
	 */
	private void checkFreeToDelete(List<Recipe> recipes) {
		Set<Long> deleted = recipes.stream().map(Recipe::getId).collect(Collectors.toSet());
		for (Recipe recipe : recipes) {
			List<String> users = recipeRepository.findRecipesLinking(recipe.getId())
				.stream()
				.filter(user -> !deleted.contains(user.getId()))
				.map(Recipe::getTitle)
				.toList();
			if (!users.isEmpty()) {
				throw new ApiException(ErrorCode.RECIPE_LINKED_IN_USE,
						"« " + recipe.getTitle() + " » est utilisée dans " + quoted(users) + " : retirez-la d'abord de cette recette");
			}
		}
		List<String> inShop = shopProductRepository.findTitlesOfRecipes(deleted);
		if (!inShop.isEmpty()) {
			throw new ApiException(ErrorCode.RECIPE_IN_SHOP, "Dans la boutique : " + quoted(inShop) + ". Retirez-la d'abord de la boutique");
		}
	}

	private static String quoted(List<String> names) {
		return names.stream().map(name -> "« " + name + " »").collect(Collectors.joining(", "));
	}

	/** Its address on the site once published; null for a draft or a failed one, not on the site. */
	private static @Nullable String publicPath(Recipe recipe) {
		return recipe.getStatus() == RecipeStatus.PUBLISHED
				? RecipePagesChanged.path(recipe.getMainCategory().getSlug(), recipe.getSlug())
				: null;
	}

	/** Search engines are told once the transaction is committed (see RecipePagesChanged). */
	private void pagesChanged(Stream<@Nullable String> paths) {
		List<String> changed = paths.filter(Objects::nonNull).distinct().toList();
		if (!changed.isEmpty()) {
			events.publishEvent(new RecipePagesChanged(changed));
		}
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
		if (form.status() == RecipeStatus.FAILED) {
			throw new ApiException(ErrorCode.RECIPE_STATUS_FAILED_NOT_SETTABLE);
		}
		checkPublicationOfLinks(recipe, parts, form.status());
		RecipeTheme theme = themeOf(categories.getFirst(), form.theme());
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
			if (form.status() != RecipeStatus.PUBLISHED && scheduledAt == null) {
				throw new ApiException(ErrorCode.FEATURED_RECIPE_MUST_BE_PUBLISHED);
			}
			// Done before changing the entity: the flush preceding this update must not write a second
			// featured recipe, which the database would reject. A scheduled one waits for its publication.
			if (form.status() == RecipeStatus.PUBLISHED) {
				recipeRepository.unfeatureAllExcept(recipe.getId());
			}
		}
		recipe.setTitle(Texts.capitalizeFirstLetter(form.title().strip()));
		recipe.setIntro(form.intro());
		recipe.setStatus(form.status());
		recipe.setTheme(theme);
		recipe.setPublicationFailure(null);
		recipe.setFeatured(form.featured());
		recipe.setShowNutrition(Boolean.TRUE.equals(form.showNutrition()));
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
		recipe.getQuestions().clear();
		recipe.getQuestions().addAll(questions(form.questions()));
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

	/**
	 * What visitors read must stay whole: a published recipe uses published recipes only, and a recipe a
	 * published one uses cannot leave the site.
	 */
	private void checkPublicationOfLinks(Recipe recipe, List<RecipePart> parts, RecipeStatus status) {
		if (status == RecipeStatus.PUBLISHED) {
			String unpublished = unpublishedLink(parts);
			if (unpublished != null) {
				throw new ApiException(ErrorCode.RECIPE_LINK_NOT_PUBLISHED, unpublishedLinkMessage(unpublished));
			}
			return;
		}
		if (recipe.getId() != null && recipe.getStatus() == RecipeStatus.PUBLISHED) {
			List<String> publishedUsers = recipeRepository.findRecipesLinking(recipe.getId())
				.stream()
				.filter(user -> user.getStatus() == RecipeStatus.PUBLISHED)
				.map(Recipe::getTitle)
				.toList();
			if (!publishedUsers.isEmpty()) {
				throw new ApiException(ErrorCode.RECIPE_LINKED_IN_USE,
						"Cette recette est utilisée dans " + quoted(publishedUsers) + ", publiée : elle doit rester publiée");
			}
		}
	}

	private static @Nullable String unpublishedLink(List<RecipePart> parts) {
		return parts.stream()
			.map(RecipePart::getLinkedRecipe)
			.filter(Objects::nonNull)
			.filter(linked -> linked.getStatus() != RecipeStatus.PUBLISHED)
			.map(Recipe::getTitle)
			.findFirst()
			.orElse(null);
	}

	private static String unpublishedLinkMessage(String title) {
		return "Cette recette utilise « " + title + " », qui n'est pas publiée : publiez-la d'abord";
	}

	/**
	 * The theme of the main category; the one chosen for the recipe only when that category holds
	 * both ("Apéritifs"), required then.
	 */
	static RecipeTheme themeOf(Category mainCategory, @Nullable RecipeTheme chosen) {
		if (mainCategory.getTheme() != null) {
			return mainCategory.getTheme();
		}
		if (chosen == null) {
			throw new ApiException(ErrorCode.RECIPE_THEME_REQUIRED);
		}
		return chosen;
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
			if (formPart.linkedRecipeId() != null) {
				parts.add(linkedPart(recipe, formPart, title, position));
				continue;
			}
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
		// A linked recipe has at least one of each
		if (parts.stream().allMatch(part -> part.getIngredients().isEmpty() && part.getLinkedRecipe() == null)) {
			throw new ApiException(ErrorCode.RECIPE_INGREDIENT_REQUIRED);
		}
		if (parts.stream().allMatch(part -> part.getSteps().isEmpty() && part.getLinkedRecipe() == null)) {
			throw new ApiException(ErrorCode.RECIPE_STEP_REQUIRED);
		}
		return parts;
	}

	/** Another recipe taken as a part: never itself, even through another, and {@link LinkedRecipes#MAX_LEVELS} levels at most. */
	private RecipePart linkedPart(Recipe recipe, RecipeForm.Part formPart, @Nullable String title, int position) {
		if (!formPart.ingredients().isEmpty() || !formPart.steps().isEmpty()) {
			throw new ApiException(ErrorCode.RECIPE_LINK_WITH_CONTENT);
		}
		Recipe linked = recipeRepository.findById(formPart.linkedRecipeId())
			.orElseThrow(() -> new ApiException(ErrorCode.RECIPE_LINK_NOT_FOUND));
		if (recipe.getId() != null && LinkedRecipes.reaches(linked, recipe.getId())) {
			throw new ApiException(ErrorCode.RECIPE_LINK_CYCLE);
		}
		if (levelsAbove(recipe, new HashSet<>()) + LinkedRecipes.levelsBelow(linked) > LinkedRecipes.MAX_LEVELS) {
			throw new ApiException(ErrorCode.RECIPE_LINK_TOO_DEEP);
		}
		RecipePart part = new RecipePart();
		part.setRecipe(recipe);
		part.setPosition(position);
		part.setTitle(title != null ? title : linked.getTitle());
		part.setLinkedRecipe(linked);
		part.setLinkedRatio(formPart.linkedRatio() == null ? BigDecimal.ONE : formPart.linkedRatio());
		return part;
	}

	/** Levels above a recipe, itself included: 1 for a recipe no other uses. */
	private int levelsAbove(Recipe recipe, Set<Long> seen) {
		if (recipe.getId() == null || !seen.add(recipe.getId())) {
			return 1;
		}
		int highest = recipeRepository.findRecipesLinking(recipe.getId())
			.stream()
			.mapToInt(user -> levelsAbove(user, seen))
			.max()
			.orElse(0);
		seen.remove(recipe.getId());
		return 1 + highest;
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

	/** Trimmed, with a capital letter; a recipe trashed before the questions existed has none (null). */
	static List<RecipeQuestion> questions(@Nullable List<RecipeQuestion> questions) {
		return questions == null ? List.of()
				: questions.stream()
					.map(item -> new RecipeQuestion(Texts.capitalizeFirstLetter(item.question().strip()),
							Texts.capitalizeFirstLetter(item.answer().strip())))
					.toList();
	}

	/** The form that would save {@code recipe} again: duplicate, restore from the trash. */
	private static RecipeForm formOf(RecipeDetail recipe, String title, RecipeStatus status, RecipeTheme theme,
			List<Long> categoryIds, List<Long> tagIds, Function<RecipeDetail.LinkedRecipe, Long> linkedId) {
		RecipeDetail.Mold mold = recipe.mold();
		return new RecipeForm(title, recipe.intro(), status, theme, false, recipe.showsNutrition(), categoryIds, tagIds, recipe.servings(),
				recipe.prepMinutes(), recipe.cookMinutes(), recipe.restMinutes(), recipe.difficulty(),
				recipe.youtubeVideoId() == null ? null : "https://www.youtube.com/watch?v=" + recipe.youtubeVideoId(),
				recipe.tip(), recipe.equipment(), recipe.questions(), mold == null ? null : new RecipeForm.Mold(mold.shape(), mold.lengthCm(), mold.widthCm()),
				null,
				recipe.parts().stream().map(part -> new RecipeForm.Part(part.title(),
						part.ingredients().stream()
							.map(line -> new RecipeForm.IngredientLine(line.name(), line.quantity(), line.unit(), line.note()))
							.toList(),
						part.steps().stream()
							.map(step -> new RecipeForm.Step(step.description(), step.durationMinutes(),
									step.ingredientPositions() == null ? List.of() : step.ingredientPositions()))
							.toList(),
						part.linkedRecipe() == null ? null : linkedId.apply(part.linkedRecipe()),
						part.linkedRecipe() == null ? null : part.linkedRecipe().ratio()))
					.toList());
	}

	private static <T> List<Long> ids(List<T> items, Function<T, Long> id) {
		return items.stream().map(id).toList();
	}

}
