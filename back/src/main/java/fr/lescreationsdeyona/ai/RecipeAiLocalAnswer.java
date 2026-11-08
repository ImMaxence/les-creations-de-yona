package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** What the model of the browser answered, as it wrote it. */
public record RecipeAiLocalAnswer(@Schema(description = "A JSON object, possibly with text around it") @NotBlank @Size(max = 200_000) String answer) {
}
