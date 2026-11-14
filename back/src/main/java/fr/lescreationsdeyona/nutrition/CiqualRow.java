package fr.lescreationsdeyona.nutrition;

import java.math.BigDecimal;
import org.jspecify.annotations.Nullable;

/**
 * A food as the Ciqual table gives it, per 100 g: null for a constituent it does not give. Stored as such
 * (ciqual_food), read as a {@link CiqualFood}.
 */
record CiqualRow(int code, String name, String subgroupCode, @Nullable String subgroupName, @Nullable BigDecimal kcal,
		@Nullable BigDecimal proteins, @Nullable BigDecimal carbohydrates, @Nullable BigDecimal sugars, @Nullable BigDecimal fat,
		@Nullable BigDecimal saturatedFat, @Nullable BigDecimal fibre, @Nullable BigDecimal salt) {

	/**
	 * What is missing counts as 0. Energy the table does not give is worked out from what it gives (4 kcal a
	 * gram of proteins or carbohydrates, 9 of fat, 2 of fibre), as the labels do.
	 */
	CiqualFood food() {
		double kcal = this.kcal != null ? this.kcal.doubleValue()
				: 4 * value(proteins) + 4 * value(carbohydrates) + 9 * value(fat) + 2 * value(fibre);
		return new CiqualFood(code, name, subgroupCode, subgroupName, new NutritionFacts(kcal, value(proteins),
				value(carbohydrates), value(sugars), value(fat), value(saturatedFat), value(fibre), value(salt)));
	}

	private static double value(@Nullable BigDecimal grams) {
		return grams == null ? 0 : grams.doubleValue();
	}

}
