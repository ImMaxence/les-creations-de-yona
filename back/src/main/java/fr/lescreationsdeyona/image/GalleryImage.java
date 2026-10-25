package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An image of the back-office gallery, with what shows it: both lists empty when unused. */
public record GalleryImage(UUID id, ImageKind kind, Instant createdAt,
		@Schema(description = "Recipes showing it, by title") List<UsingRecipe> recipes,
		@Schema(description = "Categories showing it, by name") List<UsingCategory> categories) {

	public record UsingRecipe(Long id, String title) {
	}

	public record UsingCategory(Long id, String name, String slug) {
	}

	/** A recipe showing an image, as read by {@link ImageRepository}. */
	record RecipeUsage(UUID imageId, Long id, String title) {
	}

	/** A category showing an image, as read by {@link ImageRepository}. */
	record CategoryUsage(UUID imageId, Long id, String name, String slug) {
	}

}
