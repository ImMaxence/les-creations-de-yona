package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Notes for an article, to be written by the model of the browser. */
public record CapAiLocalRequest(@NotBlank @Size(max = 20_000) String text,
		@Schema(description = "AUTO when absent") @Nullable CapAiForm form) {
}
