package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A recipe in a grid of cards (home page, recipes page). */
public record RecipeCard(String title, String slug, @Nullable UUID imageId, Instant createdAt,
		@Schema(description = "First publication: the date shown; absent only for cards kept in a browser before 1.1")
		@Nullable Instant publishedAt,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		@Schema(description = "Absent only for cards kept in a browser before 1.10") @Nullable RecipeTheme theme) {
}
