package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An image of the back-office gallery, with what shows it: lists empty and aboutPage false when unused. */
public record GalleryImage(UUID id, ImageKind kind, Instant createdAt,
		@Schema(description = "Recipes showing it, by title") List<UsingRecipe> recipes,
		@Schema(description = "Categories showing it, by name") List<UsingCategory> categories,
		@Schema(description = "Shown in the \"À propos\" section of the home page") boolean aboutPage) {

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
