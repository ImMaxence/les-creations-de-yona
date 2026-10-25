package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/** A row of the back-office recipe list. */
public record RecipeAdminSummary(Long id, String title, String slug, RecipeStatus status, boolean featured,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		Instant updatedAt) {
}
