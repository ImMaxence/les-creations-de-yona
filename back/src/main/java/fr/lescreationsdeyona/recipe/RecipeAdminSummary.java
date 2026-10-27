package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A row of the back-office recipe list. */
public record RecipeAdminSummary(Long id, String title, String slug, RecipeStatus status, boolean featured,
		@Nullable UUID imageId,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		Instant createdAt, Instant updatedAt,
		@Schema(description = "Visits of its page on the site, the admins' own left out") long viewCount,
		@Schema(description = "A draft to be published at that time") @Nullable Instant scheduledAt) {
}
