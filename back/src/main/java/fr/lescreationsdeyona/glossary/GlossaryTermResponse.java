package fr.lescreationsdeyona.glossary;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record GlossaryTermResponse(Long id, String name,
		@Schema(description = "Anchor on the glossary page: /glossaire#{slug}") String slug,
		@Schema(description = "Absent for a word kept for later, in the back-office only: \"À compléter\"") @Nullable String definition,
		@Schema(description = "Other spellings found in the steps, besides the name") List<String> forms) {
}
