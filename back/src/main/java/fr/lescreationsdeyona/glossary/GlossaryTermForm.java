package fr.lescreationsdeyona.glossary;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Creation or update of a glossary word. Its first letter is capitalized; the slug is generated at
 * creation and never changes after.
 */
public record GlossaryTermForm(
		@NotBlank @Size(max = 60) String name,
		@Schema(description = "Absent for a word kept for later (\"Garder pour plus tard\"): shown nowhere on the site until it has one")
		@Size(max = 600) @Nullable String definition,
		@Schema(description = "Other spellings found in the steps (conjugated verb, plural…); empty for none")
		@NotNull @Size(max = 20) List<@NotNull @Size(max = 60) String> forms) {
}
