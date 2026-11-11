package fr.lescreationsdeyona.cap;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** An article of "Mon CAP". Its photos come from the gallery; its address is made from its title. */
public record CapEntryForm(
		@NotBlank @Size(max = 150) String title,
		@Schema(description = "Under the title, smaller") @Size(max = 200) @Nullable String subtitle,
		@NotNull LocalDate happenedOn,
		@Schema(description = "The main photo, a landscape photo of the gallery: at the top of the article and in the timeline")
		@Nullable UUID imageId,
		@NotNull CapStyle style,
		@Schema(description = "In order; empty for none") @NotNull @Size(max = CapBlocks.MAX_BLOCKS) List<@Valid @NotNull CapBlock> blocks,
		@Schema(description = "DRAFT or PUBLISHED: FAILED is set by the site only") @NotNull CapStatus status,
		@Schema(description = "A draft only: published by the site at that time, then the article is on the site")
		@Nullable Instant scheduledAt,
		@Schema(description = "\"Mettre en avant\": on the home page in place of the latest article, until taken off") @NotNull Boolean featured) {
}
