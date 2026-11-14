package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.nutrition.CiqualFood;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** An ingredient without nutrition facts, and the Ciqual foods it most probably is. */
public record NutritionSuggestion(IngredientResponse ingredient,
		@Schema(description = "3 at most, the likeliest first; empty when none comes close") List<CiqualFood> foods) {
}
