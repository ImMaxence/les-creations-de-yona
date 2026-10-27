package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.tag.TagResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A full recipe: public recipe page, and back-office edit form. */
public record RecipeDetail(Long id, String title, String slug, @Nullable String intro, RecipeStatus status,
		boolean featured,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		@Schema(description = "Sorted by name; empty when none") List<TagResponse> tags,
		@Nullable Integer servings, @Nullable Integer prepMinutes, @Nullable Integer cookMinutes,
		@Schema(description = "Resting, rising…, counted in the total time") @Nullable Integer restMinutes,
		@Schema(description = "From 1 to 5, by half points") @Nullable BigDecimal difficulty,
		@Schema(description = "Id of the YouTube video shown at the bottom of the recipe") @Nullable String youtubeVideoId,
		@Schema(description = "\"Le conseil de Yona\", Markdown rendered by the front") @Nullable String tip,
		@Schema(description = "Equipment needed (moule à tarte, fouet…), in order; empty when none") List<String> equipment,
		@Schema(description = "Mold the quantities are written for") @Nullable Mold mold,
		@Nullable UUID imageId,
		@Schema(description = "Vertical photo for Pinterest; absent: the main photo is offered") @Nullable UUID pinterestImageId,
		@Schema(description = "At least one: a recipe without parts has a single, untitled one")
		List<Part> parts,
		Instant createdAt, Instant updatedAt,
		@Schema(description = "First publication; absent for a recipe never published") @Nullable Instant publishedAt,
		@Schema(description = "A draft to be published at that time") @Nullable Instant scheduledAt) {

	/** A part of the recipe (the dough, the filling…), with its own ingredients and steps. */
	public record Part(@Schema(description = "Absent for the single part of a recipe without parts") @Nullable String title,
			List<IngredientLine> ingredients, List<Step> steps) {
	}

	public record IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Nullable String note) {
	}

	/** Text or Markdown, rendered by the front. */
	public record Step(String description, @Nullable Integer durationMinutes,
			@Schema(description = "Ingredients the step needs, by position in its part's list (from 0); empty when it does not say")
			List<Integer> ingredientPositions) {
	}

	/** Width for a rectangle only; centimeters. */
	public record Mold(MoldShape shape, BigDecimal lengthCm, @Nullable BigDecimal widthCm) {
	}

}
