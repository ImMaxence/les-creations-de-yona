package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * The nutrition facts of a recipe, added up from its ingredients: per serving, for the whole recipe and per
 * 100 g, with its Nutri-Score. An estimate: the edible part of each ingredient, the raw weight unless the admin
 * gives the weight once cooked; the ingredients that cannot be counted are named.
 */
public record RecipeNutrition(
		@Schema(description = "Servings the facts per serving are for; absent when the recipe gives none") @Nullable Integer servings,
		@Schema(description = "Weight of the ingredients counted, raw and as eaten (bones, peel… left out), in grams") double grams,
		@Schema(description = "Absent when the recipe gives no servings") @Nullable NutritionFacts perServing,
		NutritionFacts total,
		@Schema(description = "Of the dish once cooked when its weight is given, raw otherwise") NutritionFacts per100g,
		@Schema(description = "Absent when no ingredient is counted") @Nullable NutriScore nutriScore,
		@Schema(description = "Ingredient lines counted") int countedLines,
		@Schema(description = "Ingredients left out, each once, in the order of the recipe") List<MissingIngredient> missing,
		@Schema(description = "The Ciqual table the foods come from: \"Ciqual 2025\"") String ciqualVersion,
		@Schema(description = "Some ingredients counted with the values of their label (a product of a brand…)") boolean fromLabels,
		@Schema(description = "Every ingredient has its nutrition facts, every quantity is weighed: only then does the page of the "
				+ "recipe show them. A line without quantity (\"sel, au goût\") of an ingredient that has its facts does not prevent it")
		boolean complete,
		@Schema(description = "Weight of the whole recipe once cooked, given by the admin; absent: per 100 g is of the raw weight")
		@Nullable Integer cookedGrams,
		@Schema(description = "The grid of the Nutri-Score the recipe is graded with") NutriScoreKind nutriScoreKind,
		@Schema(description = "Share of its energy brought by proteins, in percent (4 kcal a gram)") int proteinEnergyPercent,
		@Schema(description = "\"Source de protéines\" from 12 %, \"Riche en protéines\" from 20 % of its energy (European rules "
				+ "of nutrition claims); absent below") @Nullable ProteinClaim proteinClaim,
		@Schema(description = "The 3 ingredients bringing the most energy, the most first: a quantity typed wrong shows there")
		List<Contributor> contributors) {

	/** Nothing left out but lines without quantity of ingredients that have their facts. */
	static boolean isComplete(List<MissingIngredient> missing) {
		return missing.stream().allMatch(item -> item.reason() == Reason.NO_QUANTITY);
	}

	/** An ingredient the facts leave out, and why. */
	public record MissingIngredient(String name, Reason reason) {
	}

	public enum Reason {

		/** "Sel, au goût": nothing to count, the ingredient having its facts. */
		NO_QUANTITY,

		/** Counted in pieces ("2 gousses"), without the weight of one piece. */
		NO_WEIGHT,

		/** Neither a Ciqual food nor the values of a label. */
		NO_VALUES

	}

	/** An ingredient of the recipe and the energy it brings, all its lines together. */
	public record Contributor(String name, @Schema(description = "For the whole recipe") double kcal,
			@Schema(description = "Of the energy of the recipe") int percent) {
	}

}
