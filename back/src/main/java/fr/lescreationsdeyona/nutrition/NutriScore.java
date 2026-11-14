package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The Nutri-Score of a recipe, estimated as for a food in general by the 2023 algorithm (Santé publique France):
 * points for energy, sugars, saturated fat and salt, minus points for proteins, fibre and fruits, vegetables and
 * legumes, all per 100 g. Proteins do not count once the first ones reach 11 points. The recipe being no
 * packaged food, the official logo is not shown: an estimate of the site, in its own words.
 */
public record NutriScore(@Schema(description = "A (best) to E") String grade,
		@Schema(description = "From -17 (best) to 55: the points that give the grade") int score) {

	private static final double[] ENERGY_KJ = { 335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350 };

	private static final double[] SUGARS = { 3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51 };

	private static final double[] SATURATED_FAT = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };

	private static final double[] SALT = { 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4,
			3.6, 3.8, 4 };

	private static final double[] PROTEINS = { 2.4, 4.8, 7.2, 9.6, 12, 14, 17 };

	private static final double[] FIBRE = { 3.0, 4.1, 5.2, 6.3, 7.4 };

	/** Beyond them, proteins no longer count: a food rich in them would otherwise look better than it is. */
	private static final int PROTEIN_LIMIT = 11;

	/** Of {@code per100g}, {@code fruitsVegetablesLegumes} percent of its weight being fruits, vegetables or legumes. */
	static NutriScore of(NutritionFacts per100g, double fruitsVegetablesLegumes) {
		int negative = points(per100g.kj(), ENERGY_KJ) + points(per100g.sugars(), SUGARS)
				+ points(per100g.saturatedFat(), SATURATED_FAT) + points(per100g.salt(), SALT);
		int positive = points(per100g.fibre(), FIBRE) + fruitsVegetablesLegumesPoints(fruitsVegetablesLegumes);
		if (negative < PROTEIN_LIMIT) {
			positive += points(per100g.proteins(), PROTEINS);
		}
		int score = negative - positive;
		return new NutriScore(grade(score), score);
	}

	/** One point for each threshold passed (strictly). */
	private static int points(double value, double[] thresholds) {
		int points = 0;
		for (double threshold : thresholds) {
			if (value > threshold) {
				points++;
			}
		}
		return points;
	}

	/** 1 point beyond 40 %, 2 beyond 60 %, 5 beyond 80 %. */
	private static int fruitsVegetablesLegumesPoints(double percent) {
		if (percent > 80) {
			return 5;
		}
		if (percent > 60) {
			return 2;
		}
		return percent > 40 ? 1 : 0;
	}

	private static String grade(int score) {
		if (score <= 0) {
			return "A";
		}
		if (score <= 2) {
			return "B";
		}
		if (score <= 10) {
			return "C";
		}
		return score <= 18 ? "D" : "E";
	}

}
