package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A row of the trash of the back-office. */
public record TrashedItem(Long id, TrashKind kind, String title,
		@Schema(description = "A recipe's only") @Nullable RecipeStatus status,
		@Schema(description = "Photo shown next to it, still in the gallery; a deleted photo is shown by GET /api/admin/trash/{id}/image")
		@Nullable UUID imageId,
		Instant deletedAt, String deletedBy,
		@Schema(description = "When it will be erased for good") Instant erasedAt) {
}
