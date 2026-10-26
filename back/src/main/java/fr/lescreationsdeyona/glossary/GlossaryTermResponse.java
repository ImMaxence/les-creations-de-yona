package fr.lescreationsdeyona.glossary;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record GlossaryTermResponse(Long id, String name,
		@Schema(description = "Anchor on the glossary page: /glossaire#{slug}") String slug, String definition,
		@Schema(description = "Other spellings found in the steps, besides the name") List<String> forms) {
}
