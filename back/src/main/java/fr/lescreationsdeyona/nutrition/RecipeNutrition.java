package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * The nutrition facts of a recipe, added up from its ingredients: per serving, for the whole recipe and per
 * 100 g, with its Nutri-Score. An estimate: raw weights (cooking loses water), and the ingredients that cannot
 * be counted are named.
 */
public record RecipeNutrition(
		@Schema(description = "Servings the facts per serving are for; absent when the recipe gives none") @Nullable Integer servings,
		@Schema(description = "Weight of the ingredients counted, raw, in grams") double grams,
		@Schema(description = "Absent when the recipe gives no servings") @Nullable NutritionFacts perServing,
		NutritionFacts total,
		NutritionFacts per100g,
		@Schema(description = "Absent when no ingredient is counted") @Nullable NutriScore nutriScore,
		@Schema(description = "Ingredient lines counted") int countedLines,
		@Schema(description = "Ingredients left out, each once, in the order of the recipe") List<MissingIngredient> missing,
		@Schema(description = "The Ciqual table the foods come from: \"Ciqual 2025\"") String ciqualVersion,
		@Schema(description = "Some ingredients counted with the values of their label (a product of a brand…)") boolean fromLabels) {

	/** An ingredient the facts leave out, and why. */
	public record MissingIngredient(String name, Reason reason) {
	}

	public enum Reason {

		/** "Sel, au goût": nothing to count. */
		NO_QUANTITY,

		/** Counted in pieces ("2 gousses"), without the weight of one piece. */
		NO_WEIGHT,

		/** Neither a Ciqual food nor the values of a label. */
		NO_VALUES

	}

}
