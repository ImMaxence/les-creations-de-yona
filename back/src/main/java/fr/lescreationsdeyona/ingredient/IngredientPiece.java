package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** What one piece of an ingredient weighs, and how it is called: an egg weighs 50 g. */
public record IngredientPiece(
		@Schema(description = "Weight of one piece, in grams") @NotNull @DecimalMin(value = "0.01") @Digits(integer = 5, fraction = 2)
		BigDecimal grams,
		@Schema(description = "\"œuf\"") @NotBlank @Size(max = 50) String singular,
		@Schema(description = "\"œufs\"") @NotBlank @Size(max = 50) String plural) {
}
