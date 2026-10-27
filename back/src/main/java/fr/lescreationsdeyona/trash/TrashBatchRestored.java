package fr.lescreationsdeyona.trash;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** What a restore of several things brought back, and what stayed in the trash. */
public record TrashBatchRestored(@Schema(description = "In the order restored") List<TrashRestored> restored,
		@Schema(description = "Still in the trash, with the reason") List<Failure> failed) {

	public record Failure(Long id, String title, @Schema(description = "In French, for the admin") String message) {
	}

}
