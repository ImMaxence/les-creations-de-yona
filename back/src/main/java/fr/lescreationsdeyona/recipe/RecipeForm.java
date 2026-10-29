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
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Creation or update of a recipe. Parts, ingredients and steps are in display order. An ingredient
 * is given by name: an existing one is reused (case and accents ignored), otherwise it is created.
 */
public record RecipeForm(
		@NotBlank @Size(max = 150) String title,
		@Size(max = 1000) @Nullable String intro,
		@Schema(description = "DRAFT or PUBLISHED: FAILED is set by the site only") @NotNull RecipeStatus status,
		@NotNull RecipeTheme theme,
		@Schema(description = "Published, or scheduled: featured once published, in place of the featured recipe of its theme")
		@NotNull Boolean featured,
		@Schema(description = "Each one once; the first one is the main category, in the recipe URL")
		@NotEmpty @Size(max = 10) List<@NotNull Long> categoryIds,
		@Schema(description = "Absent or empty for none") @Size(max = 20) @Nullable List<@NotNull Long> tagIds,
		@Positive @Nullable Integer servings,
		@PositiveOrZero @Nullable Integer prepMinutes,
		@PositiveOrZero @Nullable Integer cookMinutes,
		@Schema(description = "Resting, rising…, counted in the total time") @PositiveOrZero @Nullable Integer restMinutes,
		@Schema(description = "From 1 to 5, by half points") @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 1)
		@Nullable BigDecimal difficulty,
		@Schema(description = "YouTube link (watch, youtu.be, shorts…); blank for no video") @Size(max = 300)
		@Nullable String videoUrl,
		@Schema(description = "\"Le conseil de Yona\" (tip, storage, variant…), Markdown; blank for none") @Size(max = 2000)
		@Nullable String tip,
		@Schema(description = "Equipment needed (moule à tarte, fouet…), in order; absent or empty for none")
		@Size(max = 30) @Nullable List<@NotBlank @Size(max = 100) String> equipment,
		@Schema(description = "Mold the quantities are written for; absent for none") @Valid @Nullable Mold mold,
		@Schema(description = "Drafts only: published by the backend at that time, which must be in the future")
		@Nullable Instant scheduledAt,
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

	/**
	 * Same shape as {@link RecipeDetail.Step}, {@link Mold} as {@link RecipeDetail.Mold}: the OpenAPI
	 * description names both after the record, so they must not differ.
	 */
	public record Step(
			@NotBlank @Size(max = 5000) String description,
			@Positive @Nullable Integer durationMinutes,
			@Schema(description = "Ingredients the step needs, by position in its part's list (from 0); empty when it does not say")
			@NotNull @Size(max = 100) List<@NotNull @PositiveOrZero Integer> ingredientPositions) {
	}

	/** Width for a rectangle only; centimeters, to the millimeter. */
	public record Mold(
			@NotNull MoldShape shape,
			@Schema(description = "Diameter (round), side (square) or length (rectangle), in cm")
			@NotNull @DecimalMin("1") @DecimalMax("200") @Digits(integer = 3, fraction = 1) BigDecimal lengthCm,
			@Schema(description = "Rectangle only, in cm") @DecimalMin("1") @DecimalMax("200") @Digits(integer = 3, fraction = 1)
			@Nullable BigDecimal widthCm) {
	}

}
