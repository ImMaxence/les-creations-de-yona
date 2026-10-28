package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.recipe.RecipeCard;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the API answers about menus. */
public final class MenuResponses {

	private MenuResponses() {
	}

	/** A menu in a list: the site's page of menus, the home page, the back-office. */
	public record MenuSummary(Long id, String title, String slug, @Nullable String intro, boolean published,
			@Schema(description = "Its recipes on the site (published ones only); all of them in the back-office")
			int recipeCount,
			@Schema(description = "Photo chosen for it, or else that of its first recipe that has one") @Nullable UUID imageId,
			Instant updatedAt) {
	}

	/** The page of a published menu: its published recipes, in order. */
	public record MenuDetail(String title, String slug, @Nullable String intro,
			@Schema(description = "Photo chosen for it, or else that of its first recipe that has one") @Nullable UUID imageId,
			List<RecipeCard> recipes, Instant updatedAt) {
	}

	/** A menu in the back-office editor: every recipe, drafts included. */
	public record AdminMenu(Long id, String title, String slug, @Nullable String intro, boolean published,
			@Schema(description = "Photo chosen for it; null when it shows that of its first recipe") @Nullable UUID imageId,
			List<MenuRecipe> recipes, Instant updatedAt) {
	}

	public record MenuRecipe(Long id, String title, RecipeStatus status) {
	}

}
