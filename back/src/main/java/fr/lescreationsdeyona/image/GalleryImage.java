package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** An image of the back-office gallery. */
public record GalleryImage(UUID id, ImageKind kind, Instant createdAt,
		@Schema(description = "Title of the recipe or name of the category showing it; null when unused")
		@Nullable String usedBy) {
}
