package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An image of the back-office gallery. */
public record GalleryImage(UUID id, ImageKind kind, Instant createdAt,
		@Schema(description = "Titles of the recipes and names of the categories showing it; empty when unused")
		List<String> usedBy) {
}
