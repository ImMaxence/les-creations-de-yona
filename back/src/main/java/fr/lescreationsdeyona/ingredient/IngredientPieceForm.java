package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import org.jspecify.annotations.Nullable;

/** The weight of one piece of an ingredient, or none (bought by weight). */
public record IngredientPieceForm(@Schema(description = "Absent: no equivalent shown") @Valid @Nullable IngredientPiece piece) {
}
