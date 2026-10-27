package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

public record IngredientResponse(Long id, String name,
		@Schema(description = "Shop aisle, for the shopping list; absent until set") @Nullable Aisle aisle,
		@Schema(description = "Number of recipes using it, drafts included") long recipeCount) {
}
