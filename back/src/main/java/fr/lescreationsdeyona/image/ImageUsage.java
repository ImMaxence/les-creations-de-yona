package fr.lescreationsdeyona.image;

import java.util.UUID;

/** A recipe title or a category name showing an image. */
record ImageUsage(UUID imageId, String label) {
}
