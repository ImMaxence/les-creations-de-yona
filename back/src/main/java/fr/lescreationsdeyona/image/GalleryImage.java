package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An image of the back-office gallery, with what shows it: lists empty and aboutPage false when unused. */
public record GalleryImage(UUID id, ImageKind kind, Instant createdAt,
		@Schema(description = "Recipes showing it, by title") List<UsingRecipe> recipes,
		@Schema(description = "Categories showing it, by name") List<UsingCategory> categories,
		@Schema(description = "Menus showing it as their own photo, by title") List<UsingMenu> menus,
		@Schema(description = "Shown in the \"À propos\" section of the home page") boolean aboutPage,
		@Schema(description = "Articles of \"Mon CAP\" showing it, as their photo or in a block, by title") List<String> capItems,
		@Schema(description = "Products of the shop showing it, by name") List<String> shopProducts) {

	public record UsingRecipe(Long id, String title) {
	}

	public record UsingCategory(Long id, String name, String slug) {
	}

	public record UsingMenu(Long id, String title) {
	}

	/** A recipe showing an image, as read by {@link ImageRepository}. */
	record RecipeUsage(UUID imageId, Long id, String title) {
	}

	/** A category showing an image, as read by {@link ImageRepository}. */
	record CategoryUsage(UUID imageId, Long id, String name, String slug) {
	}

	/** A menu showing an image, as read by {@link ImageRepository}. */
	record MenuUsage(UUID imageId, Long id, String title) {
	}

	/** An article of "Mon CAP" showing an image, as read by {@link ImageRepository}. */
	record CapUsage(UUID imageId, Long id, String title) {
	}

	/** A product of the shop showing an image, as read by {@link ImageRepository}. */
	record ProductUsage(UUID imageId, Long id, String name) {
	}

}
