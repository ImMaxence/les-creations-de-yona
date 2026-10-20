package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import java.time.Instant;

/** A row of the back-office recipe list. */
public record RecipeAdminSummary(Long id, String title, String slug, RecipeStatus status, boolean featured,
		CategoryResponse category, Instant updatedAt) {
}
