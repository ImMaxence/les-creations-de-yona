package fr.lescreationsdeyona.cap;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A step of "Mon CAP". Its photo comes from the gallery. */
public record CapEntryForm(
		@NotBlank @Size(max = 150) String title,
		@Schema(description = "Markdown; blank for a step with a title only") @Size(max = 10000) @Nullable String body,
		@NotNull LocalDate happenedOn,
		@Schema(description = "A landscape photo of the gallery") @Nullable UUID imageId,
		@NotNull Boolean published) {
}
