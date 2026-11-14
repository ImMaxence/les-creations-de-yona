package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.common.Quantities;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.Contributor;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.MissingIngredient;
import fr.lescreationsdeyona.nutrition.RecipeNutrition.Reason;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;

/**
 * Adds up the nutrition facts of the lines of a recipe: each quantity in grams ("2 c. à soupe" are 30 g, 3 eggs
 * three times the weight of one), its edible part only, times what 100 g of its ingredient hold.
 */
final class NutritionCalculator {

	/** The ingredients bringing the most energy, named to the admin. */
	static final int CONTRIBUTORS = 3;

	private NutritionCalculator() {
	}

	/** A line of the recipe, linked recipes unfolded and their quantities multiplied. */
	record Line(String name, @Nullable BigDecimal quantity, @Nullable String unit) {
	}

	/**
	 * What the site knows of an ingredient: its facts per 100 g (null without any), the weight of one piece, and the
	 * share of it eaten, in percent (68 for a whole chicken: its bones are not).
	 */
	record Ingredient(@Nullable NutritionFacts per100g, boolean fruitVegetableOrLegume, boolean fromLabel,
			@Nullable BigDecimal pieceGrams, int ediblePercent) {

		/** All of it eaten. */
		Ingredient(@Nullable NutritionFacts per100g, boolean fruitVegetableOrLegume, boolean fromLabel, @Nullable BigDecimal pieceGrams) {
			this(per100g, fruitVegetableOrLegume, fromLabel, pieceGrams, 100);
		}

	}

	/** The general grid of the Nutri-Score, per 100 g of the raw weight. */
	static RecipeNutrition compute(List<Line> lines, Function<String, @Nullable Ingredient> ingredients, @Nullable Integer servings,
			String ciqualVersion) {
		return compute(lines, ingredients, servings, null, NutriScoreKind.GENERAL, ciqualVersion);
	}

	/**
	 * {@code ingredients}: by the name of a line, null for an ingredient the site does not have yet. {@code cookedGrams}:
	 * the weight of the whole recipe once cooked, for the facts per 100 g and the Nutri-Score; null for the raw weight.
	 */
	static RecipeNutrition compute(List<Line> lines, Function<String, @Nullable Ingredient> ingredients, @Nullable Integer servings,
			@Nullable Integer cookedGrams, NutriScoreKind kind, String ciqualVersion) {
		NutritionFacts total = NutritionFacts.NONE;
		double grams = 0;
		double fruitsVegetablesLegumes = 0;
		int counted = 0;
		boolean fromLabels = false;
		Set<MissingIngredient> missing = new LinkedHashSet<>();
		// By folded name: the name of its first line, and the energy of all of them
		Map<String, String> names = new LinkedHashMap<>();
		Map<String, Double> kcalByName = new LinkedHashMap<>();
		for (Line line : lines) {
			Ingredient ingredient = ingredients.apply(line.name());
			// An ingredient without facts first: even without quantity, the recipe is not complete without them
			if (ingredient == null || ingredient.per100g() == null) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_VALUES));
				continue;
			}
			if (line.quantity() == null || line.quantity().signum() <= 0) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_QUANTITY));
				continue;
			}
			BigDecimal weight = Quantities.grams(line.quantity(), line.unit(), ingredient.pieceGrams());
			if (weight == null) {
				missing.add(new MissingIngredient(line.name(), Reason.NO_WEIGHT));
				continue;
			}
			double lineGrams = weight.doubleValue() * ingredient.ediblePercent() / 100;
			NutritionFacts facts = ingredient.per100g().times(lineGrams / 100);
			total = total.plus(facts);
			grams += lineGrams;
			if (ingredient.fruitVegetableOrLegume()) {
				fruitsVegetablesLegumes += lineGrams;
			}
			fromLabels |= ingredient.fromLabel();
			counted++;
			String key = Texts.foldCaseAndAccents(line.name().strip());
			names.putIfAbsent(key, line.name().strip());
			kcalByName.merge(key, facts.kcal(), Double::sum);
		}
		double basis = cookedGrams != null && cookedGrams > 0 && grams > 0 ? cookedGrams : grams;
		NutritionFacts per100g = basis > 0 ? total.times(100 / basis) : NutritionFacts.NONE;
		NutritionFacts perServing = servings != null && servings > 0 ? total.times(1.0 / servings).rounded() : null;
		NutriScore nutriScore = grams > 0 ? NutriScore.of(per100g, fruitsVegetablesLegumes * 100 / grams, kind) : null;
		List<MissingIngredient> left = List.copyOf(missing);
		double proteinPercent = ProteinClaim.energyPercent(total);
		return new RecipeNutrition(servings, Math.round(grams), perServing, total.rounded(), per100g.rounded(), nutriScore,
				counted, left, ciqualVersion, fromLabels, counted > 0 && RecipeNutrition.isComplete(left),
				grams > 0 ? cookedGrams : null, kind, (int) Math.round(proteinPercent),
				counted > 0 ? ProteinClaim.of(proteinPercent) : null, contributors(names, kcalByName, total.kcal()));
	}

	/** The most energy first, those bringing none left out. */
	private static List<Contributor> contributors(Map<String, String> names, Map<String, Double> kcalByName, double totalKcal) {
		return kcalByName.entrySet()
			.stream()
			.filter(entry -> entry.getValue() > 0)
			.sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()))
			.limit(CONTRIBUTORS)
			.map(entry -> new Contributor(names.get(entry.getKey()), Math.round(entry.getValue()),
					(int) Math.round(entry.getValue() * 100 / totalKcal)))
			.toList();
	}

}
