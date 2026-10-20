package fr.lescreationsdeyona.recipe;

/** Title autocompletion; both slugs build the link {@code /recettes/{categorySlug}/{slug}}. */
public record RecipeSuggestion(String title, String slug, String categorySlug) {
}
