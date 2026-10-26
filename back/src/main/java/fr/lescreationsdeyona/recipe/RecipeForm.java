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
 * Creation or update of a recipe. Parts, ingredients and steps are in display order. An ingredient
 * is given by name: an existing one is reused (case and accents ignored), otherwise it is created.
 */
public record RecipeForm(
		@NotBlank @Size(max = 150) String title,
		@Size(max = 1000) @Nullable String intro,
		@NotNull RecipeStatus status,
		@NotNull Boolean featured,
		@Schema(description = "Each one once; the first one is the main category, in the recipe URL")
		@NotEmpty @Size(max = 10) List<@NotNull Long> categoryIds,
		@Schema(description = "Absent or empty for none") @Size(max = 20) @Nullable List<@NotNull Long> tagIds,
		@Positive @Nullable Integer servings,
		@PositiveOrZero @Nullable Integer prepMinutes,
		@PositiveOrZero @Nullable Integer cookMinutes,
		@Schema(description = "From 1 to 5, by half points") @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 1)
		@Nullable BigDecimal difficulty,
		@Schema(description = "YouTube link (watch, youtu.be, shorts…); blank for no video") @Size(max = 300)
		@Nullable String videoUrl,
		@Schema(description = "A single untitled part for a recipe without parts. At least one ingredient and one step in all")
		@NotEmpty @Size(max = 10) List<@Valid @NotNull Part> parts) {

	/** Not empty: at least one ingredient or one step. */
	public record Part(
			@Schema(description = "Required when the recipe has several parts") @Size(max = 100) @Nullable String title,
			@NotNull @Size(max = 100) List<@Valid @NotNull IngredientLine> ingredients,
			@NotNull @Size(max = 100) List<@Valid @NotNull Step> steps) {
	}

	/** An ingredient appears once per part, but may appear in several parts. */
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
