package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.recipe.RecipeTheme;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record CategoryResponse(Long id, String name, String slug, @Nullable UUID imageId,
		@Schema(description = "Given to the recipes whose main category it is; absent for a category holding both")
		@Nullable RecipeTheme theme,
		@Schema(description = "Themes of its published recipes, for the menus of the site (a category holding both may "
				+ "have sweet recipes only); filled by the list of the categories, empty elsewhere")
		List<RecipeTheme> publishedThemes) {
}
