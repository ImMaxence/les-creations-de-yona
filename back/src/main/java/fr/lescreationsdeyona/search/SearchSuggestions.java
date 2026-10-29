package fr.lescreationsdeyona.search;

import fr.lescreationsdeyona.recipe.RecipeSuggestion;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** What the search box suggests while typing, by kind; each list may be empty. */
public record SearchSuggestions(
		@Schema(description = "Published recipes mentioning each word (title, category, tag, ingredient), of the theme typed, 5 at most")
		List<RecipeSuggestion> recipes,
		@Schema(description = "\"Sucré\" or \"Salé\" typed (accents matter: \"sucre\" is the ingredient), or a theme beginning "
				+ "with what is typed (\"sal\")")
		List<RecipeTheme> themes,
		@Schema(description = "Categories with a published recipe, whose name holds each word") List<Named> categories,
		@Schema(description = "Tags of published recipes, whose name holds each word") List<Named> tags,
		@Schema(description = "Published menus, whose title holds each word") List<Named> menus,
		@Schema(description = "Ingredients of published recipes whose name holds each word, or is one of the words "
				+ "(\"Yaourt\" for \"gâteau au yaourt\")")
		List<String> ingredients) {

	/** A category, a tag or a menu: its name and the slug of its page or filter. */
	public record Named(String name, String slug) {
	}

}
