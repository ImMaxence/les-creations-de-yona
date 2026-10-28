package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.recipe.RecipeForm;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * A recipe read by the AI, to fill the editor: nothing is saved. Checked against the limits of
 * {@link RecipeForm}; categories and tags among those of the site, ingredients under the name the
 * site already knows them by.
 */
public record RecipeAiDraft(@Nullable String title, @Nullable String intro, @Nullable Integer servings,
		@Nullable Integer prepMinutes, @Nullable Integer cookMinutes, @Nullable Integer restMinutes,
		@Schema(description = "From 1 to 5, by half points") @Nullable BigDecimal difficulty, @Nullable String tip,
		List<String> equipment, RecipeForm.@Nullable Mold mold,
		@Schema(description = "Among the site's, the most fitting first") List<Long> categoryIds,
		@Schema(description = "Among the site's") List<Long> tagIds,
		@Schema(description = "At least one; a single untitled part for a recipe without parts") List<RecipeForm.Part> parts) {
}
