package fr.lescreationsdeyona.recipe;

import java.util.List;

/**
 * Public recipe pages that changed (published, edited, unpublished, deleted), handled once their
 * transaction is committed: search engines are told to crawl them again (IndexNow).
 *
 * @param paths {@code /recettes/{main category}/{recipe}}, each once
 */
public record RecipePagesChanged(List<String> paths) {

	static String path(String mainCategorySlug, String recipeSlug) {
		return "/recettes/" + mainCategorySlug + "/" + recipeSlug;
	}

}
