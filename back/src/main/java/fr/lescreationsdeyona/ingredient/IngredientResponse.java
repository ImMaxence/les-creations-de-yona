package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

public record IngredientResponse(Long id, String name,
		@Schema(description = "Shop aisle, for the shopping list; absent until set") @Nullable Aisle aisle,
		@Schema(description = "Number of recipes using it, drafts included") long recipeCount,
		@Schema(description = "Weight of one piece, for \"400 g (≈ 8 œufs)\"; absent when bought by weight") @Nullable IngredientPiece piece,
		@Schema(description = "For the nutrition facts of the recipes; absent until set") @Nullable IngredientNutrition nutrition) {
}
