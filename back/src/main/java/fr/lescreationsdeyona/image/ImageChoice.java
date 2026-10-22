package fr.lescreationsdeyona.image;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Shows an image of the gallery on a recipe or a category; null removes its photo, kept in the gallery. */
public record ImageChoice(@Nullable UUID imageId) {
}
