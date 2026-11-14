package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.nutrition.NutritionLabel;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** The nutrition facts of an ingredient: a Ciqual food, or the values of its label, or none (both absent). */
public record IngredientNutritionForm(
		@Schema(description = "Code of the Ciqual food it is") @Positive @Nullable Integer ciqualCode,
		@Schema(description = "What its label says for 100 g, for a product the Ciqual table does not have") @Valid @Nullable NutritionLabel label,
		@Schema(description = "With a label: where it comes from (\"Open Food Facts · Kinder Bueno · Ferrero · 3017626998106\"); absent when typed")
		@Size(max = 300) @Nullable String labelSource) {
}
