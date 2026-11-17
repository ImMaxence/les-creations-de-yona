package fr.lescreationsdeyona.cap;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An article of "Mon CAP" published for the first time (2.24; by the admin, or at its scheduled time), handled once
 * its transaction is committed: the subscribers are told then, as for a recipe.
 *
 * @param path {@code /mon-cap/{slug}}
 */
public record CapPublished(String title, String path, @Nullable String subtitle, @Nullable UUID imageId) {

	static CapPublished of(CapEntry entry) {
		return new CapPublished(entry.getTitle(), "/mon-cap/" + entry.getSlug(), entry.getSubtitle(),
				entry.getImage() == null ? null : entry.getImage().getId());
	}

}
