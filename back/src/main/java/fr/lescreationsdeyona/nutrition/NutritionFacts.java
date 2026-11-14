package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What a quantity of food holds: energy in kcal, the rest in grams. Per 100 g for a food, per serving or for
 * the whole recipe once added up.
 */
public record NutritionFacts(@Schema(description = "Energy, in kcal") double kcal,
		@Schema(description = "Grams") double proteins,
		@Schema(description = "Grams, sugars included") double carbohydrates,
		@Schema(description = "Grams") double sugars,
		@Schema(description = "Grams, saturated fat included") double fat,
		@Schema(description = "Grams") double saturatedFat,
		@Schema(description = "Grams") double fibre,
		@Schema(description = "Grams") double salt) {

	public static final NutritionFacts NONE = new NutritionFacts(0, 0, 0, 0, 0, 0, 0, 0);

	/** 1 kcal = 4,184 kJ: the energy the Nutri-Score counts. */
	static final double KJ_PER_KCAL = 4.184;

	public NutritionFacts plus(NutritionFacts other) {
		return new NutritionFacts(kcal + other.kcal, proteins + other.proteins, carbohydrates + other.carbohydrates,
				sugars + other.sugars, fat + other.fat, saturatedFat + other.saturatedFat, fibre + other.fibre, salt + other.salt);
	}

	public NutritionFacts times(double factor) {
		return new NutritionFacts(kcal * factor, proteins * factor, carbohydrates * factor, sugars * factor, fat * factor,
				saturatedFat * factor, fibre * factor, salt * factor);
	}

	/** As shown: the kilocalorie, a tenth of a gram, a hundredth of a gram of salt. */
	public NutritionFacts rounded() {
		return new NutritionFacts(Math.round(kcal), tenth(proteins), tenth(carbohydrates), tenth(sugars), tenth(fat),
				tenth(saturatedFat), tenth(fibre), Math.round(salt * 100) / 100.0);
	}

	double kj() {
		return kcal * KJ_PER_KCAL;
	}

	private static double tenth(double grams) {
		return Math.round(grams * 10) / 10.0;
	}

}
