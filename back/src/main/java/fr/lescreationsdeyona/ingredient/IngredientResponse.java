package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;

public record IngredientResponse(Long id, String name,
		@Schema(description = "Number of recipes using it, drafts included") long recipeCount) {
}
