package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/** What a restore created again. */
public record TrashRestored(TrashKind kind, String title,
		@Schema(description = "What was created again (recipe, category, menu, tag, ingredient, word); absent for a photo") @Nullable Long id,
		@Schema(description = "A recipe's only") @Nullable RecipeStatus status,
		@Schema(description = "Menus a recipe is back in; recipes, categories, menus and \"À propos\" a photo is back on; recipes a tag is back on")
		int placesBack) {
}
