package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The 2023 algorithm for foods in general, per 100 g. */
class NutriScoreTest {

	private static NutritionFacts facts(double kcal, double proteins, double sugars, double saturatedFat, double fibre, double salt) {
		return new NutritionFacts(kcal, proteins, sugars, sugars, saturatedFat, saturatedFat, fibre, salt);
	}

	@Test
	void givesESugarAndAToAnApple() {
		// Sugar: 1 669 kJ (4 points) and 99,7 g of sugars (15), proteins not counted
		NutriScore sugar = NutriScore.of(facts(399, 0, 99.7, 0, 0, 0.005), 0);
		assertThat(sugar).isEqualTo(new NutriScore("E", 19));
		// An apple: 3 points of sugars, minus 5 for being a fruit
		NutriScore apple = NutriScore.of(facts(52, 0.3, 10.6, 0, 1.4, 0), 100);
		assertThat(apple).isEqualTo(new NutriScore("A", -2));
	}

	@Test
	void addsUpEachComponent() {
		// Energy 837 kJ: 2, sugars 5 g: 1, saturated fat 2,5 g: 2, salt 0,5 g: 2; proteins 8 g: 3, fibre 3,5 g: 1, 50 % of fruits: 1
		assertThat(NutriScore.of(facts(200, 8, 5, 2.5, 3.5, 0.5), 50)).isEqualTo(new NutriScore("B", 2));
	}

	@Test
	void stopsCountingProteinsFrom11Points() {
		// 2 092 kJ: 6 points, 20 g of sugars: 5; the 20 g of proteins would be worth 6
		assertThat(NutriScore.of(facts(500, 20, 20, 0, 0, 0), 0)).isEqualTo(new NutriScore("D", 11));
		// One point less (17 g of sugars: 4), and their 7 points count
		assertThat(NutriScore.of(facts(500, 20, 17, 0, 0, 0), 0)).isEqualTo(new NutriScore("C", 3));
	}

	@Test
	void countsAThresholdOnlyOncePassed() {
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0.2), 0).score()).isZero();
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0.21), 0).score()).isEqualTo(1);
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 5), 0).score()).isEqualTo(20);
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0), 40).score()).isZero();
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0), 61).score()).isEqualTo(-2);
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0), 81).score()).isEqualTo(-5);
	}

	@Test
	void gradesByTheBoundsOfFoodsInGeneral() {
		// Salt alone gives any score from 0 to 20
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0), 0).grade()).isEqualTo("A");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0.3), 0).grade()).isEqualTo("B");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0.5), 0).grade()).isEqualTo("B");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 0.7), 0).grade()).isEqualTo("C");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 2.1), 0).grade()).isEqualTo("C");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 2.3), 0).grade()).isEqualTo("D");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 3.7), 0).grade()).isEqualTo("D");
		assertThat(NutriScore.of(facts(0, 0, 0, 0, 0, 3.9), 0).grade()).isEqualTo("E");
	}

}
