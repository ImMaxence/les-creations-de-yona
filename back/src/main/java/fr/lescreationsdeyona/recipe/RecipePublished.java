package fr.lescreationsdeyona.recipe;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A recipe published for the first time (by the admin, or at its scheduled time), handled once its
 * transaction is committed: subscribers are notified then.
 *
 * @param path {@code /recettes/{main category}/{recipe}}
 */
public record RecipePublished(String title, String path, @Nullable String intro, @Nullable UUID imageId) {

	static RecipePublished of(Recipe recipe) {
		return new RecipePublished(recipe.getTitle(),
				"/recettes/" + recipe.getMainCategory().getSlug() + "/" + recipe.getSlug(), recipe.getIntro(),
				recipe.getImage() == null ? null : recipe.getImage().getId());
	}

}
