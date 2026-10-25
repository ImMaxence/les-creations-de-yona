package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Merges ingredients written several ways: the recipes using them all switch to a single one,
 * either one of them ({@code keptId}) or one named {@code newName} (created if needed).
 */
public record IngredientMergeForm(
		@NotNull @Size(min = 2, max = 50) List<@NotNull Long> ingredientIds,
		@Schema(description = "One of ingredientIds, kept as is; give it or newName") @Nullable Long keptId,
		@Schema(description = "Name of the single ingredient left; give it or keptId") @Size(max = 100)
		@Nullable String newName) {
}
