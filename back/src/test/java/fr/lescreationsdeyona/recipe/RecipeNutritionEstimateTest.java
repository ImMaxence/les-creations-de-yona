package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.nutrition.NutriScoreKind;
import fr.lescreationsdeyona.nutrition.NutritionFacts;
import fr.lescreationsdeyona.nutrition.NutritionService;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import fr.lescreationsdeyona.shop.ShopProductRepository;
import fr.lescreationsdeyona.tag.TagService;
import fr.lescreationsdeyona.trash.TrashBin;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

/** The nutrition facts of the editor, and of the page of a recipe: its lines, linked recipes unfolded. */
class RecipeNutritionEstimateTest {

	private static final RecipeNutrition NUTRITION = new RecipeNutrition(4, 100, NutritionFacts.NONE, NutritionFacts.NONE,
			NutritionFacts.NONE, null, 1, List.of(), "Ciqual 2025", false, true, null, NutriScoreKind.GENERAL, 0, null, List.of());

	/** The butter has no facts yet. */
	private static final RecipeNutrition INCOMPLETE = new RecipeNutrition(4, 100, NutritionFacts.NONE, NutritionFacts.NONE,
			NutritionFacts.NONE, null, 1, List.of(new RecipeNutrition.MissingIngredient("Beurre", RecipeNutrition.Reason.NO_VALUES)),
			"Ciqual 2025", false, false, null, NutriScoreKind.GENERAL, 0, null, List.of());

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final RecipeMapper mapper = mock(RecipeMapper.class);

	private final NutritionService nutritionService = mock(NutritionService.class);

	private final RecipeService service = new RecipeService(recipeRepository, mock(CategoryRepository.class),
			mock(IngredientService.class), mock(ImageService.class), mock(TagService.class), mock(MenuService.class),
			mock(TrashBin.class), mapper, mock(ApplicationEventPublisher.class), mock(AuditLog.class),
			mock(ShopProductRepository.class), nutritionService, mock(RecipeCards.class), mock(PublishedNutrition.class));

	@SuppressWarnings("unchecked")
	private final ArgumentCaptor<List<NutritionService.Line>> lines = ArgumentCaptor.forClass(List.class);

	/** "Pâte sablée": 200 g of flour and 100 g of butter, for 6. */
	private Recipe dough;

	@BeforeEach
	void writesTheDough() {
		Category category = new Category();
		category.setSlug("bases");
		dough = new Recipe();
		dough.setId(2L);
		dough.setTitle("Pâte sablée");
		dough.setSlug("pate-sablee");
		dough.setStatus(RecipeStatus.PUBLISHED);
		dough.setServings(6);
		dough.getCategories().add(category);
		RecipePart part = new RecipePart();
		part.setRecipe(dough);
		part.getIngredients().add(line(part, "Farine", "200"));
		part.getIngredients().add(line(part, "Beurre", "100"));
		dough.getParts().add(part);
		when(recipeRepository.findById(2L)).thenReturn(Optional.of(dough));
		when(mapper.toDetail(any())).thenAnswer(invocation -> detail(invocation.getArgument(0)));
		when(nutritionService.compute(anyList(), any(), any(), any())).thenReturn(NUTRITION);
	}

	private static RecipeIngredient line(RecipePart part, String name, String grams) {
		Ingredient ingredient = new Ingredient();
		ingredient.setName(name);
		RecipeIngredient line = new RecipeIngredient();
		line.setPart(part);
		line.setIngredient(ingredient);
		line.setQuantity(new BigDecimal(grams));
		line.setUnit("g");
		return line;
	}

	private static RecipeDetail detail(Recipe recipe) {
		List<RecipeDetail.Part> parts = recipe.getParts().stream().map(part -> new RecipeDetail.Part(part.getTitle(),
				part.getIngredients().stream()
					.map(line -> new RecipeDetail.IngredientLine(line.getIngredient().getName(), line.getQuantity(), line.getUnit(), null))
					.toList(),
				List.of())).toList();
		return new RecipeDetail(recipe.getId(), recipe.getTitle(), recipe.getSlug(), null, recipe.getStatus(), RecipeTheme.SWEET, false,
				recipe.isShowNutrition(), recipe.getCookedGrams(), recipe.getNutriScoreKind(), null, List.of(), List.of(), recipe.getServings(), null, null, null, null, null, null, List.of(),
				List.of(), null, null, null, parts, Instant.EPOCH, Instant.EPOCH, null, null, null);
	}

	@Test
	void countsTheLinesOfTheEditorAndTheRecipesItUses() {
		NutritionEstimateForm form = new NutritionEstimateForm(8, null, null, List.of(
				new NutritionEstimateForm.Part(List.of(), 2L, new BigDecimal("0.5")),
				new NutritionEstimateForm.Part(List.of(new NutritionEstimateForm.Line(" Citron ", new BigDecimal("3"), null),
						new NutritionEstimateForm.Line("  ", null, null)), null, null)));

		RecipeNutrition estimate = service.estimateNutrition(form);

		assertThat(estimate).isSameAs(NUTRITION);
		verify(nutritionService).compute(lines.capture(), eq(8), eq(null), eq(null));
		// Half of the dough, the lemons of the form; the blank line being typed left out
		assertThat(lines.getValue()).extracting(NutritionService.Line::name).containsExactly("Farine", "Beurre", "Citron");
		assertThat(lines.getValue().get(0).quantity()).isEqualByComparingTo("100");
		assertThat(lines.getValue().get(1).quantity()).isEqualByComparingTo("50");
	}

	@Test
	void showsTheFactsOnThePageOnlyWhenAsked() {
		when(recipeRepository.findBySlugAndStatus("pate-sablee", RecipeStatus.PUBLISHED)).thenReturn(Optional.of(dough));

		assertThat(service.getPublished("pate-sablee").nutrition()).isNull();

		dough.setShowNutrition(true);
		RecipeDetail shown = service.getPublished("pate-sablee");

		assertThat(shown.nutrition()).isSameAs(NUTRITION);
		verify(nutritionService).compute(lines.capture(), eq(6), eq(null), eq(NutriScoreKind.GENERAL));
		assertThat(lines.getValue()).extracting(NutritionService.Line::name).containsExactly("Farine", "Beurre");
	}

	@Test
	void hidesIncompleteFactsAndListsTheirRecipe() {
		when(recipeRepository.findBySlugAndStatus("pate-sablee", RecipeStatus.PUBLISHED)).thenReturn(Optional.of(dough));
		when(nutritionService.compute(anyList(), any(), any(), any())).thenReturn(INCOMPLETE);
		dough.setShowNutrition(true);

		assertThat(service.getPublished("pate-sablee").nutrition()).isNull();
		when(recipeRepository.findByShowNutritionTrue()).thenReturn(List.of(dough));
		assertThat(service.withIncompleteNutrition()).containsExactly(2L);
		// Completed: no longer listed
		when(nutritionService.compute(anyList(), any(), any(), any())).thenReturn(NUTRITION);
		assertThat(service.withIncompleteNutrition()).isEmpty();
	}

}
