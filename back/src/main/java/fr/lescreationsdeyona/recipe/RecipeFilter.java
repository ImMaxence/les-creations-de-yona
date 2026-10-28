package fr.lescreationsdeyona.recipe;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Recipe search criteria, each one optional, all combined.
 *
 * @param titleQuery part of the title (back-office)
 * @param text what a visitor typed (public site): each of its words in the title, a category, a tag
 *     or an ingredient, see {@link fr.lescreationsdeyona.common.SearchWords}
 * @param ingredientNames names of ingredients it must all have, in any part (case and accents
 *     ignored by the column collation); empty for any
 * @param ingredientId one of its ingredients (back-office)
 * @param imageId its photo or its Pinterest photo (back-office, from the gallery)
 * @param maxMinutes preparation, rest and cooking together at most this long; a recipe giving
 *     neither preparation nor cooking time is left out
 */
record RecipeFilter(@Nullable String titleQuery, @Nullable String text, @Nullable String categorySlug, @Nullable String tagSlug,
		List<String> ingredientNames, @Nullable Long ingredientId, @Nullable UUID imageId,
		@Nullable RecipeStatus status, @Nullable Integer maxMinutes, @Nullable DifficultyLevel difficulty) {

	RecipeFilter {
		ingredientNames = List.copyOf(ingredientNames);
	}

	static RecipeFilter publishedText(String text) {
		return new RecipeFilter(null, text, null, null, List.of(), null, null, RecipeStatus.PUBLISHED, null, null);
	}

}
