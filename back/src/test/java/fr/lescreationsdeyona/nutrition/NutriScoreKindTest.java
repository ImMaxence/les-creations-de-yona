package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The grids of the 2023 Nutri-Score other than the general one: drinks, fats, red meat, cheese. */
class NutriScoreKindTest {

	/** kcal, proteins, sugars (carbohydrates too), fat, saturated fat, fibre, salt. */
	private static NutritionFacts facts(double kcal, double proteins, double sugars, double fat, double saturatedFat, double fibre,
			double salt) {
		return new NutritionFacts(kcal, proteins, sugars, sugars, fat, saturatedFat, fibre, salt);
	}

	@Test
	void gradesADrinkWithItsOwnThresholds() {
		// A lemonade: 167 kJ, 3 points as a drink (0 as a food); 9 g of sugars, 7 points (2 as a food)
		NutritionFacts lemonade = facts(40, 0.1, 9, 0, 0, 0.1, 0);
		assertThat(NutriScore.of(lemonade, 10, NutriScoreKind.BEVERAGE)).isEqualTo(new NutriScore("E", 10));
		assertThat(NutriScore.of(lemonade, 10, NutriScoreKind.GENERAL)).isEqualTo(new NutriScore("B", 2));
		// A smoothie of fruits only: 3 + 8 points, minus 6 for its fruits (5 for a food)
		assertThat(NutriScore.of(facts(50, 0.6, 10, 0, 0, 1.5, 0), 100, NutriScoreKind.BEVERAGE)).isEqualTo(new NutriScore("C", 5));
	}

	@Test
	void keepsTheGradeAForWater() {
		assertThat(NutriScore.of(NutritionFacts.NONE, 0, NutriScoreKind.BEVERAGE)).isEqualTo(new NutriScore("B", 0));
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 0.4), 0, NutriScoreKind.BEVERAGE).grade()).isEqualTo("B");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 0.7), 0, NutriScoreKind.BEVERAGE).grade()).isEqualTo("C");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 1.3), 0, NutriScoreKind.BEVERAGE).grade()).isEqualTo("C");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 1.5), 0, NutriScoreKind.BEVERAGE).grade()).isEqualTo("D");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 2.1), 0, NutriScoreKind.BEVERAGE).grade()).isEqualTo("E");
	}

	@Test
	void weighsTheSaturatedFatOfAFatAgainstAllItsFat() {
		// A vinaigrette: 277 kJ from its saturated fat (2 points), 15 % of its fat saturated (1), 1,5 g of salt (7); its
		// proteins do not count from 7 points
		NutritionFacts vinaigrette = facts(450, 0.2, 1, 50, 7.5, 0, 1.5);
		assertThat(NutriScore.of(vinaigrette, 0, NutriScoreKind.FATS)).isEqualTo(new NutriScore("C", 10));
		// As a food: 1 883 kJ (5) and 7,5 g of saturated fat (7)
		assertThat(NutriScore.of(vinaigrette, 0, NutriScoreKind.GENERAL)).isEqualTo(new NutriScore("E", 19));
	}

	@Test
	void countsTheRatioOfAFatOnceReachedAndItsProteinsUnder7Points() {
		assertThat(NutriScore.of(facts(90, 0, 0, 10, 1, 0, 0), 0, NutriScoreKind.FATS).score()).isEqualTo(1);
		assertThat(NutriScore.of(facts(90, 0, 0, 10, 0.99, 0, 0), 0, NutriScoreKind.FATS).score()).isZero();
		// A pesto: 2 + 2 + 2 points, so its 5 g of proteins take 2 off; one more point of salt, and they do not
		assertThat(NutriScore.of(facts(500, 5, 0, 50, 8, 0, 0.5), 0, NutriScoreKind.FATS).score()).isEqualTo(4);
		assertThat(NutriScore.of(facts(500, 5, 0, 50, 8, 0, 0.7), 0, NutriScoreKind.FATS).score()).isEqualTo(7);
	}

	@Test
	void gradesAFatByItsOwnBounds() {
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 7.5, 0), 100, NutriScoreKind.FATS)).isEqualTo(new NutriScore("A", -10));
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 5.3, 0), 0, NutriScoreKind.FATS)).isEqualTo(new NutriScore("B", -3));
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 0.3), 0, NutriScoreKind.FATS).grade()).isEqualTo("B");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0, 0.7), 0, NutriScoreKind.FATS).grade()).isEqualTo("C");
	}

	@Test
	void countsTwoPointsOfProteinsAtMostForRedMeat() {
		// 628 kJ (1), 3 g of saturated fat (2), 0,5 g of salt (2); its 20 g of proteins are worth 7 points
		NutritionFacts beef = facts(150, 20, 0, 6, 3, 0, 0.5);
		assertThat(NutriScore.of(beef, 0, NutriScoreKind.GENERAL)).isEqualTo(new NutriScore("A", -2));
		assertThat(NutriScore.of(beef, 0, NutriScoreKind.RED_MEAT)).isEqualTo(new NutriScore("C", 3));
	}

	@Test
	void alwaysCountsTheProteinsOfACheese() {
		// 1 464 kJ (4), 15 g of saturated fat (10), 1,6 g of salt (7): 21 points, beyond which a food's proteins do not count
		NutritionFacts cheese = facts(350, 25, 0, 28, 15, 0, 1.6);
		assertThat(NutriScore.of(cheese, 0, NutriScoreKind.GENERAL)).isEqualTo(new NutriScore("E", 21));
		assertThat(NutriScore.of(cheese, 0, NutriScoreKind.CHEESE)).isEqualTo(new NutriScore("D", 14));
	}

}
