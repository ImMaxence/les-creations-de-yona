package fr.lescreationsdeyona.recipe;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Recipe search criteria, each one optional, all combined.
 *
 * @param ingredientName name of one of its ingredients, in any part (case and accents ignored by
 *     the column collation)
 * @param ingredientId one of its ingredients (back-office)
 * @param imageId its photo or its Pinterest photo (back-office, from the gallery)
 * @param maxMinutes preparation, rest and cooking together at most this long; a recipe giving
 *     neither preparation nor cooking time is left out
 */
record RecipeFilter(@Nullable String titleQuery, @Nullable String categorySlug, @Nullable String tagSlug,
		@Nullable String ingredientName, @Nullable Long ingredientId, @Nullable UUID imageId,
		@Nullable RecipeStatus status, @Nullable Integer maxMinutes, @Nullable DifficultyLevel difficulty) {

	static RecipeFilter publishedTitled(String titleQuery) {
		return new RecipeFilter(titleQuery, null, null, null, null, null, RecipeStatus.PUBLISHED, null, null);
	}

}
