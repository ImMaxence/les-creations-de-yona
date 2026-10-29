package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.recipe.RecipeTheme;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * Creation or update of a category. Its first letter is capitalized. The slug is generated at
 * creation and never changes after.
 */
public record CategoryForm(@NotBlank @Size(max = 60) String name,
		@Schema(description = "Given to the recipes whose main category it is; absent for a category holding both, "
				+ "whose recipes each choose theirs")
		@Nullable RecipeTheme theme) {
}
