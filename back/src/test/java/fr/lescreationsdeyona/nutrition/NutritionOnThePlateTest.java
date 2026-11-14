package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.nutrition.NutritionCalculator.Ingredient;
import fr.lescreationsdeyona.nutrition.NutritionCalculator.Line;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.Contributor;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** What is eaten: the edible part of each ingredient, the weight once cooked, the proteins, what weighs the most. */
class NutritionOnThePlateTest {

	private static final Ingredient FLOUR = new Ingredient(new NutritionFacts(350, 10, 73, 1.5, 1, 0.2, 3, 0), false, false, null);

	private static final Ingredient SUGAR = new Ingredient(new NutritionFacts(399, 0, 99.7, 99.7, 0, 0, 0, 0), false, false, null);

	private static final Ingredient EGG = new Ingredient(new NutritionFacts(140, 12.8, 0, 0, 9.8, 2.6, 0, 0.3), false, false,
			new BigDecimal("50"));

	private static final Ingredient APPLE = new Ingredient(new NutritionFacts(52, 0.3, 11, 10.6, 0.2, 0, 1.4, 0), true, false, null);

	private static final Ingredient WHEY = new Ingredient(new NutritionFacts(380, 78, 6, 4, 6, 4, 0, 0.5), false, true, null);

	/** A whole chicken of 1,5 kg: its bones are not eaten. */
	private static final Ingredient CHICKEN = new Ingredient(new NutritionFacts(200, 18, 0, 0, 14, 4, 0, 0.2), false, false,
			new BigDecimal("1500"), 68);

	private static final Map<String, Ingredient> INGREDIENTS = Map.of("Farine", FLOUR, "Sucre", SUGAR, "Œufs", EGG, "Pommes", APPLE,
			"Whey", WHEY, "Poulet fermier", CHICKEN);

	private static RecipeNutrition compute(Integer cookedGrams, NutriScoreKind kind, Line... lines) {
		return NutritionCalculator.compute(List.of(lines), INGREDIENTS::get, 4, cookedGrams, kind, "Ciqual 2025");
	}

	private static Line line(String name, String quantity, String unit) {
		return new Line(name, new BigDecimal(quantity), unit);
	}

	@Test
	void countsTheEdiblePartOnly() {
		RecipeNutrition nutrition = compute(null, NutriScoreKind.GENERAL, line("Poulet fermier", "1", null));

		// 68 % of 1 500 g
		assertThat(nutrition.grams()).isEqualTo(1020);
		assertThat(nutrition.total().kcal()).isEqualTo(2040);
		assertThat(nutrition.perServing().kcal()).isEqualTo(510);
		assertThat(nutrition.per100g().kcal()).isEqualTo(200);
	}

	@Test
	void givesPer100gOfTheDishOnceCooked() {
		Line[] cake = { line("Farine", "300", "g"), line("Sucre", "100", "g") };

		RecipeNutrition raw = compute(null, NutriScoreKind.GENERAL, cake);
		RecipeNutrition cooked = compute(320, NutriScoreKind.GENERAL, cake);

		// 1 050 + 399 kcal for 400 g raw, 320 g once baked
		assertThat(raw.per100g().kcal()).isEqualTo(362);
		assertThat(raw.cookedGrams()).isNull();
		assertThat(cooked.per100g().kcal()).isEqualTo(453);
		assertThat(cooked.cookedGrams()).isEqualTo(320);
		// What a serving holds does not change, nor the raw weight
		assertThat(cooked.perServing()).isEqualTo(raw.perServing());
		assertThat(cooked.grams()).isEqualTo(400);
		// Denser once cooked: a grade the same or worse
		assertThat(cooked.nutriScore().score()).isGreaterThanOrEqualTo(raw.nutriScore().score());
	}

	@Test
	void gradesWithTheGridOfItsKind() {
		RecipeNutrition drink = compute(null, NutriScoreKind.BEVERAGE, line("Pommes", "300", "g"), line("Sucre", "30", "g"));

		assertThat(drink.nutriScoreKind()).isEqualTo(NutriScoreKind.BEVERAGE);
		assertThat(drink.nutriScore().grade()).isNotEqualTo("A");
	}

	@Test
	void namesTheThreeIngredientsBringingTheMostEnergy() {
		RecipeNutrition nutrition = compute(null, NutriScoreKind.GENERAL, line("Farine", "300", "g"), line("Sucre", "100", "g"),
				line("Œufs", "3", null), line("Pommes", "100", "g"), line("Sucre", "50", "g"));

		// 1 050, 399 + 199,5 (its two lines), 210 and 52 kcal: 1 910,5 in all
		assertThat(nutrition.contributors()).containsExactly(new Contributor("Farine", 1050, 55), new Contributor("Sucre", 599, 31),
				new Contributor("Œufs", 210, 11));
	}

	@Test
	void saysWhatItsProteinsAllowItToClaim() {
		// 78 g of proteins for 380 kcal: 82 % of the energy
		RecipeNutrition whey = compute(null, NutriScoreKind.GENERAL, line("Whey", "100", "g"));
		assertThat(whey.proteinEnergyPercent()).isEqualTo(82);
		assertThat(whey.proteinClaim()).isEqualTo(ProteinClaim.RICH);
		// 37,8 g for 1 088 kcal: 14 %
		RecipeNutrition bread = compute(null, NutriScoreKind.GENERAL, line("Farine", "300", "g"), line("Whey", "10", "g"));
		assertThat(bread.proteinEnergyPercent()).isEqualTo(14);
		assertThat(bread.proteinClaim()).isEqualTo(ProteinClaim.SOURCE);
		// 11 %
		RecipeNutrition flour = compute(null, NutriScoreKind.GENERAL, line("Farine", "100", "g"));
		assertThat(flour.proteinEnergyPercent()).isEqualTo(11);
		assertThat(flour.proteinClaim()).isNull();
	}

	@Test
	void claimsFromTheThresholdsOfTheRules() {
		assertThat(ProteinClaim.of(11.99)).isNull();
		assertThat(ProteinClaim.of(12)).isEqualTo(ProteinClaim.SOURCE);
		assertThat(ProteinClaim.of(19.99)).isEqualTo(ProteinClaim.SOURCE);
		assertThat(ProteinClaim.of(20)).isEqualTo(ProteinClaim.RICH);
		assertThat(ProteinClaim.energyPercent(NutritionFacts.NONE)).isZero();
	}

}
