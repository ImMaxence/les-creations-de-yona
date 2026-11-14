package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.common.Quantities;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.MissingIngredient;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.Reason;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;

/**
 * Adds up the nutrition facts of the lines of a recipe: each quantity in grams ("2 c. à soupe" are 30 g, 3 eggs
 * three times the weight of one), times what 100 g of its ingredient hold.
 */
final class NutritionCalculator {

	private NutritionCalculator() {
	}

	/** A line of the recipe, linked recipes unfolded and their quantities multiplied. */
	record Line(String name, @Nullable BigDecimal quantity, @Nullable String unit) {
	}

	/** What the site knows of an ingredient: its facts per 100 g (null without any), the weight of one piece. */
	record Ingredient(@Nullable NutritionFacts per100g, boolean fruitVegetableOrLegume, boolean fromLabel,
			@Nullable BigDecimal pieceGrams) {
	}

	/** {@code ingredients}: by the name of a line, null for an ingredient the site does not have yet. */
	static RecipeNutrition compute(List<Line> lines, Function<String, @Nullable Ingredient> ingredients, @Nullable Integer servings,
			String ciqualVersion) {
		NutritionFacts total = NutritionFacts.NONE;
		double grams = 0;
		double fruitsVegetablesLegumes = 0;
		int counted = 0;
		boolean fromLabels = false;
		Set<MissingIngredient> missing = new LinkedHashSet<>();
		for (Line line : lines) {
			Ingredient ingredient = ingredients.apply(line.name());
			if (line.quantity() == null || line.quantity().signum() <= 0) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_QUANTITY));
				continue;
			}
			if (ingredient == null || ingredient.per100g() == null) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_VALUES));
				continue;
			}
			BigDecimal weight = Quantities.grams(line.quantity(), line.unit(), ingredient.pieceGrams());
			if (weight == null) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_WEIGHT));
				continue;
			}
			double lineGrams = weight.doubleValue();
			total = total.plus(ingredient.per100g().times(lineGrams / 100));
			grams += lineGrams;
			if (ingredient.fruitVegetableOrLegume()) {
				fruitsVegetablesLegumes += lineGrams;
			}
			fromLabels |= ingredient.fromLabel();
			counted++;
		}
		NutritionFacts per100g = grams > 0 ? total.times(100 / grams) : NutritionFacts.NONE;
		NutritionFacts perServing = servings != null && servings > 0 ? total.times(1.0 / servings).rounded() : null;
		NutriScore nutriScore = grams > 0 ? NutriScore.of(per100g, fruitsVegetablesLegumes * 100 / grams) : null;
		return new RecipeNutrition(servings, Math.round(grams), perServing, total.rounded(), per100g.rounded(), nutriScore,
				counted, new ArrayList<>(missing), ciqualVersion, fromLabels);
	}

}
