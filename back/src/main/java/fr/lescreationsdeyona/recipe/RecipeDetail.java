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
		boolean featured, CategoryResponse category, @Nullable Integer servings, @Nullable Integer prepMinutes,
		@Nullable Integer cookMinutes,
		@Schema(description = "From 1 to 5, by half points") @Nullable BigDecimal difficulty,
		@Schema(description = "Id of the YouTube video shown at the bottom of the recipe") @Nullable String youtubeVideoId,
		@Nullable UUID imageId, List<IngredientLine> ingredients, List<Step> steps,
		Instant createdAt, Instant updatedAt) {

	public record IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Nullable String note) {
	}

	/** Text or Markdown, rendered by the front. */
	public record Step(String description, @Nullable Integer durationMinutes) {
	}

}
