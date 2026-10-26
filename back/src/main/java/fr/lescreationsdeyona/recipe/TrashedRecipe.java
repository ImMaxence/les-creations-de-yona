package fr.lescreationsdeyona.recipe;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A row of the trash of the back-office. */
public record TrashedRecipe(Long id, String title, RecipeStatus status, @Nullable UUID imageId, Instant deletedAt,
		String deletedBy, @Schema(description = "When it will be erased for good") Instant erasedAt) {
}
