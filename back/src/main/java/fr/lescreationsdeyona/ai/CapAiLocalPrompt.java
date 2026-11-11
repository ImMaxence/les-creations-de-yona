package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;

/** What the model running in the admin's browser is told to write an article, the same rules as Gemini. */
public record CapAiLocalPrompt(@Schema(description = "Rules of the articles, and the JSON expected") String instructions,
		@Schema(description = "The shape asked, then the notes") String message) {
}
