package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A full recipe: public recipe page, and back-office edit form. */
public record RecipeDetail(Long id, String title, String slug, @Nullable String intro, RecipeStatus status,
		boolean featured, CategoryResponse category, @Nullable Integer servings, @Nullable Integer prepMinutes,
		@Nullable Integer cookMinutes, @Nullable UUID imageId, List<IngredientLine> ingredients, List<Step> steps,
		Instant createdAt, Instant updatedAt) {

	public record IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Nullable String note) {
	}

	/** Text or Markdown, rendered by the front. */
	public record Step(String description, @Nullable Integer durationMinutes) {
	}

}
