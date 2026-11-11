package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.cap.CapBlock;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * An article of "Mon CAP" written by the AI from notes, to fill the editor: nothing is saved. No
 * photo: the blocks that show one have their place and caption, the admin adds the photo.
 */
public record CapAiDraft(@Nullable String title, @Nullable String subtitle,
		@Schema(description = "At least one; photos empty, captions proposed") List<CapBlock> blocks) {
}
