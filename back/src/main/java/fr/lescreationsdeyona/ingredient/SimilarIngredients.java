package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** Ingredients probably written several ways, to be merged. */
public record SimilarIngredients(
		@Schema(description = "2 or more, the most used first") List<IngredientResponse> ingredients) {
}
