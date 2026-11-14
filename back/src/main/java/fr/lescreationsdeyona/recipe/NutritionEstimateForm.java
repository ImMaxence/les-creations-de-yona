package fr.lescreationsdeyona.recipe;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * What the nutrition facts of a recipe being written need: its servings, the lines of its parts, the recipes it
 * uses as parts. Blank lines (being typed) are left out.
 */
public record NutritionEstimateForm(@Positive @Nullable Integer servings,
		@NotNull @Size(max = 10) List<@Valid @NotNull Part> parts) {

	@Schema(name = "NutritionEstimatePart")
	public record Part(@NotNull @Size(max = 100) List<@Valid @NotNull Line> ingredients,
			@Schema(description = "Another recipe taken as this part, counted as saved") @Nullable Long linkedRecipeId,
			@Schema(description = "How many times the linked recipe: 1 when absent")
			@DecimalMin("0.05") @DecimalMax("99") @Digits(integer = 2, fraction = 2) @Nullable BigDecimal linkedRatio) {
	}

	@Schema(name = "NutritionEstimateLine")
	public record Line(@NotNull @Size(max = 100) String name,
			@Positive @Digits(integer = 6, fraction = 2) @Nullable BigDecimal quantity,
			@Size(max = 30) @Nullable String unit) {
	}

}
