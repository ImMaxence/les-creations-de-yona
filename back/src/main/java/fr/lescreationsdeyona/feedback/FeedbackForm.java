package fr.lescreationsdeyona.feedback;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** "Donner mon avis", sent by a visitor. */
public record FeedbackForm(@NotBlank @Size(max = 2000) String message,
		@Schema(description = "Optional, for an answer") @Email @Size(max = 200) @Nullable String email,
		@Schema(description = "Where the visitor was") @Size(max = 300) @Nullable String page,
		@Schema(description = "Left empty by people: a robot filling every field is ignored") @Nullable String website) {
}
