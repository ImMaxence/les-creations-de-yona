package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
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
		@Nullable Integer servings, @Nullable Integer prepMinutes, @Nullable Integer cookMinutes,
		@Schema(description = "From 1 to 5, by half points") @Nullable BigDecimal difficulty,
		@Schema(description = "Id of the YouTube video shown at the bottom of the recipe") @Nullable String youtubeVideoId,
		@Nullable UUID imageId,
		@Schema(description = "At least one: a recipe without parts has a single, untitled one")
		List<Part> parts,
		Instant createdAt, Instant updatedAt) {

	/** A part of the recipe (the dough, the filling…), with its own ingredients and steps. */
	public record Part(@Schema(description = "Absent for the single part of a recipe without parts") @Nullable String title,
			List<IngredientLine> ingredients, List<Step> steps) {
	}

	public record IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Nullable String note) {
	}

	/** Text or Markdown, rendered by the front. */
	public record Step(String description, @Nullable Integer durationMinutes) {
	}

}
