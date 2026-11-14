package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** The version of the Ciqual table the site uses. */
public record CiqualTable(@Schema(description = "\"Ciqual 2025\", named in the source of the nutrition facts") String version,
		int foodCount,
		Instant importedAt,
		@Schema(description = "Email of the admin who imported it; \"migration\" for the one installed with the site") String importedBy) {
}
