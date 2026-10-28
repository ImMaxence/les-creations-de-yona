package fr.lescreationsdeyona.search;

import fr.lescreationsdeyona.recipe.RecipeSuggestion;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** What the search box suggests while typing, by kind; each list may be empty. */
public record SearchSuggestions(
		@Schema(description = "Published recipes mentioning each word (title, category, tag, ingredient), 5 at most")
		List<RecipeSuggestion> recipes,
		@Schema(description = "Categories with a published recipe, whose name holds each word") List<Named> categories,
		@Schema(description = "Tags of published recipes, whose name holds each word") List<Named> tags,
		@Schema(description = "Published menus, whose title holds each word") List<Named> menus,
		@Schema(description = "Ingredients of published recipes, whose name holds each word") List<String> ingredients) {

	/** A category, a tag or a menu: its name and the slug of its page or filter. */
	public record Named(String name, String slug) {
	}

}
