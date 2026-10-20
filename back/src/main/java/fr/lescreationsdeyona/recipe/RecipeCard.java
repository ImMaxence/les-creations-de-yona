package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A recipe in a grid of cards (home page, recipes page). */
public record RecipeCard(String title, String slug, @Nullable UUID imageId, Instant createdAt,
		CategoryResponse category) {
}
