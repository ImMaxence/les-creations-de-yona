package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/** A product of Open Food Facts, and what its label says for 100 g (0 for a value it does not give). */
public record OpenFoodFactsProduct(@Schema(description = "Barcode") String code, String name,
		@Schema(description = "\"Kinder, Ferrero\"") @Nullable String brands,
		@Schema(description = "\"24 x 21,5 g\"") @Nullable String quantity, NutritionLabel per100g) {
}
