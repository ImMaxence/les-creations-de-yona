package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.tag.TagService;
import fr.lescreationsdeyona.trash.TrashBin;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

/** "Publier samedi à 10 h", its failures ("Échec"), "Publier maintenant", and featuring ahead. */
class RecipePublicationTest {

	private static final Instant NOW = Instant.parse("2026-11-07T09:00:00Z");

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final CategoryRepository categoryRepository = mock(CategoryRepository.class);

	private final IngredientService ingredientService = mock(IngredientService.class);

	private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);

	private final AuditLog auditLog = mock(AuditLog.class);

	private final RecipeMapper recipeMapper = mock(RecipeMapper.class);

	private final RecipeService service = new RecipeService(recipeRepository, categoryRepository, ingredientService,
			mock(ImageService.class), mock(TagService.class), mock(MenuService.class), mock(TrashBin.class), recipeMapper,
			events, auditLog);

	private final Category desserts = new Category();

	@BeforeEach
	void savesAsGiven() {
		desserts.setId(1L);
		desserts.setSlug("desserts");
		when(recipeRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
		when(recipeMapper.toDetail(any())).thenReturn(mock(RecipeDetail.class));
		when(categoryRepository.findAllById(any())).thenReturn(List.of(desserts));
		Ingredient flour = new Ingredient();
		flour.setId(5L);
		when(ingredientService.findOrCreate(anyString())).thenReturn(flour);
	}

	private Recipe scheduledAt(Instant time) {
		Recipe recipe = new Recipe();
		recipe.setId(7L);
		recipe.setTitle("Tarte");
		recipe.setSlug("tarte");
		recipe.setStatus(RecipeStatus.DRAFT);
		recipe.setTheme(RecipeTheme.SWEET);
		recipe.setScheduledAt(time);
		recipe.getCategories().add(desserts);
		when(recipeRepository.findById(7L)).thenReturn(Optional.of(recipe));
		return recipe;
	}

	private static RecipeForm form(RecipeStatus status, boolean featured, Instant scheduledAt) {
		return new RecipeForm("Tarte", null, status, RecipeTheme.SAVORY, featured, List.of(1L), null, null, null, null, null,
				null, null, null, null, null, scheduledAt,
				List.of(new RecipeForm.Part(null, List.of(new RecipeForm.IngredientLine("Farine", null, null, null)),
						List.of(new RecipeForm.Step("Mélanger", null, List.of())))));
	}

	@Test
	void publishesAtTheScheduledTime() {
		Recipe recipe = scheduledAt(NOW.minus(Duration.ofMinutes(1)));

		service.publishScheduled(7L, NOW);

		assertThat(recipe.getStatus()).isEqualTo(RecipeStatus.PUBLISHED);
		assertThat(recipe.getScheduledAt()).isNull();
		assertThat(recipe.getPublishedAt()).isEqualTo(NOW);
		verify(events).publishEvent(any(RecipePublished.class));
		verify(auditLog).record(AuditAction.PUBLISHED, AuditKind.RECIPE, "Tarte", 7L);
	}

	@Test
	void stillPublishesAfterAShortRedeployment() {
		Recipe recipe = scheduledAt(NOW.minus(Duration.ofMinutes(25)));

		service.publishScheduled(7L, NOW);

		assertThat(recipe.getStatus()).isEqualTo(RecipeStatus.PUBLISHED);
	}

	@Test
	void failsWhenTheSiteWasDownAtThatTime() {
		Instant planned = NOW.minus(Duration.ofHours(3));
		Recipe recipe = scheduledAt(planned);

		service.publishScheduled(7L, NOW);

		assertThat(recipe.getStatus()).isEqualTo(RecipeStatus.FAILED);
		assertThat(recipe.getPublicationFailure()).isEqualTo(RecipeService.LATE_FAILURE);
		// The time planned stays, shown with the reason
		assertThat(recipe.getScheduledAt()).isEqualTo(planned);
		assertThat(recipe.getPublishedAt()).isNull();
		verify(events, never()).publishEvent(any());
		verify(auditLog).record(AuditAction.PUBLICATION_FAILED, AuditKind.RECIPE, "Tarte", 7L);
	}

	@Test
	void replacesTheFeaturedRecipeOfItsThemeOncePublished() {
		Recipe recipe = scheduledAt(NOW.minus(Duration.ofMinutes(1)));
		recipe.setFeatured(true);

		service.publishScheduled(7L, NOW);

		verify(recipeRepository).unfeatureAllExcept(RecipeTheme.SWEET, 7L);
		assertThat(recipe.isFeatured()).isTrue();
	}

	@Test
	void publishesAFailedRecipeAtOnce() {
		Recipe recipe = scheduledAt(NOW.minus(Duration.ofDays(2)));
		recipe.setStatus(RecipeStatus.FAILED);
		recipe.setPublicationFailure(RecipeService.LATE_FAILURE);

		service.publishNow(7L);

		assertThat(recipe.getStatus()).isEqualTo(RecipeStatus.PUBLISHED);
		assertThat(recipe.getPublicationFailure()).isNull();
		assertThat(recipe.getScheduledAt()).isNull();
		verify(events).publishEvent(any(RecipePublished.class));
	}

	@Test
	void failsAScheduledDraftOnlyOnce() {
		Recipe recipe = scheduledAt(NOW);

		service.failScheduled(7L, "Erreur");
		service.failScheduled(7L, "Autre erreur");

		assertThat(recipe.getPublicationFailure()).isEqualTo("Erreur");
		verify(auditLog, times(1)).record(eq(AuditAction.PUBLICATION_FAILED), any(), any(), anyLong());
	}

	@Test
	void featuresAScheduledDraftAheadWithoutUnfeaturingTheCurrentOne() {
		service.create(form(RecipeStatus.DRAFT, true, Instant.now().plus(Duration.ofDays(1))));

		verify(recipeRepository, never()).unfeatureAllExcept(any(), any());
	}

	@Test
	void featuresAPublishedRecipeInPlaceOfTheOneOfItsTheme() {
		service.create(form(RecipeStatus.PUBLISHED, true, null));

		verify(recipeRepository).unfeatureAllExcept(RecipeTheme.SAVORY, null);
	}

	@Test
	void refusesToFeatureADraftNotScheduled() {
		assertThatThrownBy(() -> service.create(form(RecipeStatus.DRAFT, true, null))).extracting("code")
			.isEqualTo(ErrorCode.FEATURED_RECIPE_MUST_BE_PUBLISHED);
	}

	@Test
	void leavesTheFailedStatusToTheSite() {
		assertThatThrownBy(() -> service.create(form(RecipeStatus.FAILED, false, null))).extracting("code")
			.isEqualTo(ErrorCode.RECIPE_STATUS_FAILED_NOT_SETTABLE);
	}

	@Test
	void failsAfterThreeErrorsInARow() {
		RecipeService recipes = mock(RecipeService.class);
		when(recipes.dueForPublication(any())).thenReturn(List.of(7L));
		doThrow(new IllegalStateException("Base indisponible")).when(recipes).publishScheduled(eq(7L), any());
		ScheduledPublication scheduler = new ScheduledPublication(recipes);

		scheduler.publishDueRecipes();
		scheduler.publishDueRecipes();
		verify(recipes, never()).failScheduled(anyLong(), anyString());
		scheduler.publishDueRecipes();

		verify(recipes).failScheduled(7L, ScheduledPublication.ERROR_FAILURE);
	}

}
