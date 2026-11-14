package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.nutrition.ProteinClaim;

/** A filter of the recipes page on the nutrition facts per serving: recipes whose page shows them only. */
public enum NutritionFilter {

	/** 500 kcal a serving at most. */
	LIGHT,

	/** "Riche en protéines": 20 % of its energy from proteins at least. */
	HIGH_PROTEIN;

	boolean matches(RecipeCard.Nutrition nutrition) {
		return switch (this) {
			case LIGHT -> nutrition.light();
			case HIGH_PROTEIN -> nutrition.proteinClaim() == ProteinClaim.RICH;
		};
	}

}
