package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** The share of an ingredient, as bought, that is eaten. */
public record IngredientEdiblePartForm(
		@Schema(description = "In percent: 68 for a whole chicken (its bones are not eaten), 100 when all of it is") @Min(1) @Max(100)
		int percent) {
}
