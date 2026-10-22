package fr.lescreationsdeyona.recipe;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Creation or update of a recipe. Ingredients and steps are in display order. An ingredient is
 * given by name: an existing one is reused (case and accents ignored), otherwise it is created.
 */
public record RecipeForm(
		@NotBlank @Size(max = 150) String title,
		@Size(max = 1000) @Nullable String intro,
		@NotNull RecipeStatus status,
		@NotNull Boolean featured,
		@NotNull Long categoryId,
		@Positive @Nullable Integer servings,
		@PositiveOrZero @Nullable Integer prepMinutes,
		@PositiveOrZero @Nullable Integer cookMinutes,
		@Schema(description = "From 1 to 5, by half points") @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 1)
		@Nullable BigDecimal difficulty,
		@Schema(description = "YouTube link (watch, youtu.be, shorts…); blank for no video") @Size(max = 300)
		@Nullable String videoUrl,
		@NotEmpty @Size(max = 100) List<@Valid @NotNull IngredientLine> ingredients,
		@NotEmpty @Size(max = 100) List<@Valid @NotNull Step> steps) {

	public record IngredientLine(
			@NotBlank @Size(max = 100) String name,
			@Positive @Digits(integer = 6, fraction = 2) @Nullable BigDecimal quantity,
			@Size(max = 30) @Nullable String unit,
			@Size(max = 200) @Nullable String note) {
	}

	public record Step(
			@NotBlank @Size(max = 5000) String description,
			@Positive @Nullable Integer durationMinutes) {
	}

}
