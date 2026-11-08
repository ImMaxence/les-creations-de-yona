package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;

/** What the model running in the admin's browser is told, the same rules as Gemini. */
public record RecipeAiLocalPrompt(@Schema(description = "Rules of the site's recipes, and the JSON expected") String instructions,
		@Schema(description = "Categories, tags and ingredients of the site, put before the recipe") String context) {
}
