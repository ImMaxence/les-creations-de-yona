package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.nutrition.NutritionCalculator.Ingredient;
import fr.lescreationsdeyona.nutrition.NutritionCalculator.Line;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.MissingIngredient;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.Reason;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NutritionCalculatorTest {

	private static final Ingredient FLOUR = new Ingredient(new NutritionFacts(350, 10, 73, 1.5, 1, 0.2, 3, 0), false, false, null);

	private static final Ingredient EGG = new Ingredient(new NutritionFacts(140, 12.8, 0, 0, 9.8, 2.6, 0, 0.3), false, false,
			new BigDecimal("50"));

	private static final Ingredient SUGAR = new Ingredient(new NutritionFacts(399, 0, 99.7, 99.7, 0, 0, 0, 0), false, false, null);

	private static final Ingredient WHEY = new Ingredient(new NutritionFacts(380, 78, 6, 4, 6, 4, 0, 0.5), false, true, null);

	private static final Ingredient VANILLA = new Ingredient(NutritionFacts.NONE, false, false, null);

	private static final Ingredient APPLE = new Ingredient(new NutritionFacts(52, 0.3, 11, 10.6, 0.2, 0, 1.4, 0), true, false, null);

	private static final Ingredient SALT = new Ingredient(new NutritionFacts(0, 0, 0, 0, 0, 0, 0, 97.8), false, false, null);

	private static final Ingredient NOT_SET = new Ingredient(null, false, false, null);

	private static final Map<String, Ingredient> INGREDIENTS = Map.of("Farine", FLOUR, "Œufs", EGG, "Sucre", SUGAR, "Whey", WHEY,
			"Vanille", VANILLA, "Pommes", APPLE, "Sel", SALT, "Levure", NOT_SET);

	private static RecipeNutrition compute(Integer servings, Line... lines) {
		return NutritionCalculator.compute(List.of(lines), INGREDIENTS::get, servings, "Ciqual 2025");
	}

	private static Line line(String name, String quantity, String unit) {
		return new Line(name, quantity == null ? null : new BigDecimal(quantity), unit);
	}

	@Test
	void addsUpTheLinesInGrams() {
		RecipeNutrition nutrition = compute(4, line("Farine", "250", "g"), line("Œufs", "3", null),
				line("Sucre", "2", "c. à soupe"), line("Whey", "30", "g"));

		// 250 g, 3 eggs of 50 g, 2 spoons of 15 g, 30 g
		assertThat(nutrition.grams()).isEqualTo(460);
		assertThat(nutrition.countedLines()).isEqualTo(4);
		// 875 + 210 + 119,7 + 114 kcal
		assertThat(nutrition.total().kcal()).isEqualTo(1319);
		assertThat(nutrition.perServing().kcal()).isEqualTo(330);
		assertThat(nutrition.per100g().kcal()).isEqualTo(287);
		// 25 + 19,2 + 23,4 g
		assertThat(nutrition.perServing().proteins()).isEqualTo(16.9);
		assertThat(nutrition.servings()).isEqualTo(4);
		assertThat(nutrition.fromLabels()).isTrue();
		assertThat(nutrition.ciqualVersion()).isEqualTo("Ciqual 2025");
		assertThat(nutrition.missing()).isEmpty();
		assertThat(nutrition.nutriScore()).isNotNull();
	}

	@Test
	void namesWhatItCannotCount() {
		RecipeNutrition nutrition = compute(4, line("Farine", "200", "g"), line("Sel", null, null), line("Vanille", "1", "gousse"),
				line("Levure", "1", "sachet"), line("Chocolat", "100", "g"), line("Sel", null, "pincée"));

		assertThat(nutrition.countedLines()).isEqualTo(1);
		assertThat(nutrition.missing()).containsExactly(new MissingIngredient("Sel", Reason.NO_QUANTITY),
				new MissingIngredient("Vanille", Reason.NO_WEIGHT), new MissingIngredient("Levure", Reason.NO_VALUES),
				new MissingIngredient("Chocolat", Reason.NO_VALUES));
		assertThat(nutrition.fromLabels()).isFalse();
	}

	@Test
	void countsFruitsInTheNutriScore() {
		RecipeNutrition apples = compute(2, line("Pommes", "500", "g"));
		RecipeNutrition sweetened = compute(2, line("Pommes", "500", "g"), line("Sucre", "500", "g"));

		assertThat(apples.nutriScore()).isEqualTo(new NutriScore("A", -2));
		// Half of the weight sugar: 17 points, minus 1 for 50 % of fruits
		assertThat(sweetened.nutriScore()).isEqualTo(new NutriScore("D", 16));
	}

	@Test
	void givesTheWholeRecipeWithoutServings() {
		RecipeNutrition nutrition = compute(null, line("Farine", "100", "g"));

		assertThat(nutrition.perServing()).isNull();
		assertThat(nutrition.total().kcal()).isEqualTo(350);
		assertThat(nutrition.per100g()).isEqualTo(nutrition.total());
	}

	@Test
	void hasNoNutriScoreWithoutAnythingCounted() {
		RecipeNutrition nutrition = compute(4, line("Levure", "10", "g"));

		assertThat(nutrition.grams()).isZero();
		assertThat(nutrition.nutriScore()).isNull();
		assertThat(nutrition.per100g()).isEqualTo(NutritionFacts.NONE);
	}

	@Test
	void roundsAsShown() {
		NutritionFacts rounded = new NutritionFacts(329.67, 16.96, 1.04, 0.05, 2.449, 1.25, 0.94, 0.1249).rounded();

		assertThat(rounded).isEqualTo(new NutritionFacts(330, 17.0, 1.0, 0.1, 2.4, 1.3, 0.9, 0.12));
	}

}
