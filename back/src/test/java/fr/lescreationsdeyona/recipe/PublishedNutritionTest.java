package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.nutrition.NutriScoreKind;
import fr.lescreationsdeyona.nutrition.NutritionFacts;
import fr.lescreationsdeyona.nutrition.NutritionService;
import fr.lescreationsdeyona.nutrition.ProteinClaim;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The facts per serving said on the cards, and the filters of the recipes page. */
class PublishedNutritionTest {

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final RecipeMapper mapper = mock(RecipeMapper.class);

	private final NutritionService nutritionService = mock(NutritionService.class);

	private final PublishedNutrition published = new PublishedNutrition(recipeRepository, mapper, nutritionService);

	private static RecipeNutrition nutrition(Integer servings, double kcal, double proteins, ProteinClaim claim, boolean complete) {
		NutritionFacts serving = new NutritionFacts(kcal, proteins, 0, 0, 0, 0, 0, 0);
		return new RecipeNutrition(servings, 500, servings == null ? null : serving, serving, serving, null, 3, List.of(),
				"Ciqual 2025", false, complete, null, NutriScoreKind.GENERAL, 0, claim, List.of());
	}

	private Recipe recipe(long id, RecipeNutrition facts) {
		Recipe recipe = new Recipe();
		recipe.setId(id);
		recipe.setServings(facts.servings());
		RecipeDetail detail = new RecipeDetail(id, "Recette " + id, "recette-" + id, null, RecipeStatus.PUBLISHED, RecipeTheme.SAVORY,
				false, true, null, NutriScoreKind.GENERAL, null, List.of(), List.of(), facts.servings(), null, null, null, null, null,
				null, List.of(), List.of(), null, null, null, List.of(), Instant.EPOCH, Instant.EPOCH, null, null, null);
		when(mapper.toDetail(recipe)).thenReturn(detail);
		return recipe;
	}

	@Test
	void keepsTheCompleteFactsOfTheRecipesGivingTheirServings() {
		Recipe salad = recipe(1, nutrition(2, 420, 30, ProteinClaim.RICH, true));
		Recipe cake = recipe(2, nutrition(8, 520, 6, null, true));
		Recipe draft = recipe(3, nutrition(4, 300, 10, null, false));
		Recipe noServings = recipe(4, nutrition(null, 300, 10, null, true));
		when(recipeRepository.findByShowNutritionTrueAndStatus(RecipeStatus.PUBLISHED)).thenReturn(List.of(salad, cake, draft, noServings));
		when(nutritionService.compute(anyList(), any(), any(), any())).thenReturn(nutrition(2, 420, 30, ProteinClaim.RICH, true),
				nutrition(8, 520, 6, null, true), nutrition(4, 300, 10, null, false), nutrition(null, 300, 10, null, true));

		Map<Long, RecipeCard.Nutrition> perServing = published.perServing();

		assertThat(perServing).containsOnlyKeys(1L, 2L);
		assertThat(perServing.get(1L)).isEqualTo(new RecipeCard.Nutrition(420, 30, ProteinClaim.RICH, true));
		assertThat(perServing.get(2L)).isEqualTo(new RecipeCard.Nutrition(520, 6, null, false));
	}

	@Test
	void filtersOnALightServingOrOneRichInProteins() {
		RecipeCard.Nutrition light = new RecipeCard.Nutrition(500, 8, null, true);
		RecipeCard.Nutrition rich = new RecipeCard.Nutrition(650, 40, ProteinClaim.RICH, false);
		RecipeCard.Nutrition source = new RecipeCard.Nutrition(450, 15, ProteinClaim.SOURCE, true);

		assertThat(NutritionFilter.LIGHT.matches(light)).isTrue();
		assertThat(NutritionFilter.LIGHT.matches(rich)).isFalse();
		assertThat(NutritionFilter.HIGH_PROTEIN.matches(rich)).isTrue();
		assertThat(NutritionFilter.HIGH_PROTEIN.matches(source)).isFalse();
		// 500 kcal: still light
		assertThat(RecipeCard.Nutrition.of(nutrition(2, 500, 8, null, true)).light()).isTrue();
		assertThat(RecipeCard.Nutrition.of(nutrition(2, 501, 8, null, true)).light()).isFalse();
	}

}
