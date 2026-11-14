package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.nutrition.NutritionFacts;
import fr.lescreationsdeyona.nutrition.NutritionLabel;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/** What 100 g of an ingredient hold, and where the site has it from: a Ciqual food, or a label. */
public record IngredientNutrition(
		@Schema(description = "Code of its Ciqual food; absent with a label") @Nullable Integer ciqualCode,
		@Schema(description = "\"Beurre à 80% MG minimum, doux\"; absent with a label") @Nullable String ciqualName,
		@Schema(description = "The values of its label, as saved; absent with a Ciqual food") @Nullable NutritionLabel label,
		@Schema(description = "Where its label comes from; absent when typed by the admin") @Nullable String labelSource,
		NutritionFacts per100g) {
}
