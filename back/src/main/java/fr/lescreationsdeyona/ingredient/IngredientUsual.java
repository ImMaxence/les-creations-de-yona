package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/** What such an ingredient usually weighs and how much of it is eaten: offered to the admin, never applied alone. */
public record IngredientUsual(
		@Schema(description = "One piece as bought, and its name: \"1 rouleau = 230 g\"; absent when not counted in pieces")
		@Nullable IngredientPiece piece,
		@Schema(description = "Share eaten, in percent (68 for a whole chicken); absent when all of it is") @Nullable Integer ediblePercent) {
}
