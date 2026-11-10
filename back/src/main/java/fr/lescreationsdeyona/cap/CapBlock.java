package fr.lescreationsdeyona.cap;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A block of an article. Which fields it uses depends on its type; the others stay empty:
 * <ul>
 * <li>TEXT: {@code text} (Markdown: paragraphs, subtitles, bold, lists, links to recipes);</li>
 * <li>IMAGE: {@code imageId}, {@code caption};</li>
 * <li>IMAGE_TEXT: {@code imageId}, {@code text}, {@code caption}, {@code side} of the photo;</li>
 * <li>STEPS: {@code photos}, 2 to 8, each numbered with its caption;</li>
 * <li>TIP: {@code text}, short, in a colored box.</li>
 * </ul>
 * A block may be saved half-filled (a template's empty photo): the site leaves out what is empty.
 */
public record CapBlock(
		@NotNull CapBlockType type,
		@Schema(description = "Markdown for TEXT and IMAGE_TEXT, plain text for TIP") @Size(max = 20000) @Nullable String text,
		@Schema(description = "A photo of the gallery, for IMAGE and IMAGE_TEXT") @Nullable UUID imageId,
		@Size(max = 300) @Nullable String caption,
		@Schema(description = "Side of the photo, for IMAGE_TEXT; LEFT when absent") @Nullable CapBlockSide side,
		@Schema(description = "For STEPS, in order") @Size(max = 8) @Nullable List<@Valid @NotNull CapBlockPhoto> photos) {

	/** A photo of a STEPS block, numbered by its place. */
	public record CapBlockPhoto(@Nullable UUID imageId, @Size(max = 200) @Nullable String caption) {
	}

}
