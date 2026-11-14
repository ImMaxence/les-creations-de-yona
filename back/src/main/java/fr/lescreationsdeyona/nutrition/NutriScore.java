package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The Nutri-Score of a recipe, estimated by the 2023 algorithm (Santé publique France) with the grid of its kind:
 * points for energy, sugars, saturated fat and salt, minus points for proteins, fibre and fruits, vegetables and
 * legumes, all per 100 g. The thresholds are those of Open Food Facts. The recipe being no packaged food, the
 * official logo is not shown: an estimate of the site, in its own words.
 */
public record NutriScore(@Schema(description = "A (best) to E") String grade,
		@Schema(description = "The points that give the grade, the fewer the better") int score) {

	private static final double[] ENERGY_KJ = { 335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350 };

	private static final double[] ENERGY_KJ_BEVERAGES = { 30, 90, 150, 210, 240, 270, 300, 330, 360, 390 };

	/** Fats: the energy of their saturated fat only, 37 kJ a gram. */
	private static final double[] ENERGY_FROM_SATURATED_FAT_KJ = { 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200 };

	private static final double KJ_PER_GRAM_OF_FAT = 37;

	private static final double[] SUGARS = { 3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51 };

	private static final double[] SUGARS_BEVERAGES = { 0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11 };

	private static final double[] SATURATED_FAT = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };

	/** Fats: saturated fat in percent of all fat, each threshold reached (not passed) a point. */
	private static final double[] SATURATED_FAT_RATIO = { 10, 16, 22, 28, 34, 40, 46, 52, 58, 64 };

	private static final double[] SALT = { 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4,
			3.6, 3.8, 4 };

	private static final double[] PROTEINS = { 2.4, 4.8, 7.2, 9.6, 12, 14, 17 };

	private static final double[] PROTEINS_BEVERAGES = { 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0 };

	private static final double[] FIBRE = { 3.0, 4.1, 5.2, 6.3, 7.4 };

	/** Beyond them, proteins no longer count: a food rich in them would otherwise look better than it is. */
	private static final int PROTEIN_LIMIT = 11;

	/** The same for fats, oils, nuts and seeds. */
	private static final int PROTEIN_LIMIT_FATS = 7;

	/** Red meat: its proteins count this many points at most. */
	private static final int RED_MEAT_PROTEIN_POINTS = 2;

	/** As a food in general. */
	static NutriScore of(NutritionFacts per100g, double fruitsVegetablesLegumes) {
		return of(per100g, fruitsVegetablesLegumes, NutriScoreKind.GENERAL);
	}

	/** Of {@code per100g}, {@code fruitsVegetablesLegumes} percent of its weight being fruits, vegetables or legumes. */
	static NutriScore of(NutritionFacts per100g, double fruitsVegetablesLegumes, NutriScoreKind kind) {
		boolean beverage = kind == NutriScoreKind.BEVERAGE;
		boolean fats = kind == NutriScoreKind.FATS;
		int negative = (fats ? points(per100g.saturatedFat() * KJ_PER_GRAM_OF_FAT, ENERGY_FROM_SATURATED_FAT_KJ)
				: points(per100g.kj(), beverage ? ENERGY_KJ_BEVERAGES : ENERGY_KJ))
				+ points(per100g.sugars(), beverage ? SUGARS_BEVERAGES : SUGARS)
				+ (fats ? pointsReached(saturatedFatRatio(per100g), SATURATED_FAT_RATIO) : points(per100g.saturatedFat(), SATURATED_FAT))
				+ points(per100g.salt(), SALT);
		int proteins = points(per100g.proteins(), beverage ? PROTEINS_BEVERAGES : PROTEINS);
		if (kind == NutriScoreKind.RED_MEAT) {
			proteins = Math.min(proteins, RED_MEAT_PROTEIN_POINTS);
		}
		boolean proteinsCount = switch (kind) {
			case BEVERAGE, CHEESE -> true;
			case FATS -> negative < PROTEIN_LIMIT_FATS;
			case GENERAL, RED_MEAT -> negative < PROTEIN_LIMIT;
		};
		int positive = points(per100g.fibre(), FIBRE) + fruitsVegetablesLegumesPoints(fruitsVegetablesLegumes, beverage)
				+ (proteinsCount ? proteins : 0);
		int score = negative - positive;
		return new NutriScore(grade(score, kind), score);
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

	/** One point for each threshold reached. */
	private static int pointsReached(double value, double[] thresholds) {
		int points = 0;
		for (double threshold : thresholds) {
			if (value >= threshold) {
				points++;
			}
		}
		return points;
	}

	/** Saturated fat in percent of all fat; 0 without fat. */
	private static double saturatedFatRatio(NutritionFacts per100g) {
		return per100g.fat() > 0 ? per100g.saturatedFat() * 100 / per100g.fat() : 0;
	}

	/** Beyond 40 %, 60 % and 80 %: 1, 2 and 5 points, or 2, 4 and 6 for a drink. */
	private static int fruitsVegetablesLegumesPoints(double percent, boolean beverage) {
		if (percent > 80) {
			return beverage ? 6 : 5;
		}
		if (percent > 60) {
			return beverage ? 4 : 2;
		}
		if (percent > 40) {
			return beverage ? 2 : 1;
		}
		return 0;
	}

	private static String grade(int score, NutriScoreKind kind) {
		return switch (kind) {
			// A is for water only: a drink of the kitchen is B at best
			case BEVERAGE -> score <= 2 ? "B" : score <= 6 ? "C" : score <= 9 ? "D" : "E";
			case FATS -> score <= -6 ? "A" : score <= 2 ? "B" : score <= 10 ? "C" : score <= 18 ? "D" : "E";
			case GENERAL, RED_MEAT, CHEESE -> score <= 0 ? "A" : score <= 2 ? "B" : score <= 10 ? "C" : score <= 18 ? "D" : "E";
		};
	}

}
