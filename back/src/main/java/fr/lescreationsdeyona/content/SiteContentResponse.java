package fr.lescreationsdeyona.content;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record SiteContentResponse(String aboutTitle,
		@Schema(description = "Plain text; a blank line starts a new paragraph") String aboutText,
		@Schema(description = "Absent: the photo bundled with the front") @Nullable UUID aboutImageId,
		String footerText) {
}
