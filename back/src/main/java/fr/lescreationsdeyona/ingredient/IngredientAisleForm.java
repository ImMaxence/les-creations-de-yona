package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Puts ingredients, one or a selection, in a shop aisle. */
public record IngredientAisleForm(
		@NotEmpty @Size(max = 500) List<@NotNull Long> ingredientIds,
		@Schema(description = "Absent to take them out of any aisle (\"Autres\")") @Nullable Aisle aisle) {
}
