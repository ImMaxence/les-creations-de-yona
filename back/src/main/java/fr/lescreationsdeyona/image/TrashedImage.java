package fr.lescreationsdeyona.image;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A photo in the trash, as JSON: its record, deleted from the image table, and where it was shown.
 * Its files stay in the bucket until it is erased.
 */
record TrashedImage(UUID id, ImageKind kind, String s3Prefix, Instant createdAt) {

	/**
	 * Shown there when deleted: given back on restore where no other photo has been chosen meanwhile.
	 * {@code menuIds}: absent from the photos put in the trash before 3.7.
	 */
	record Links(List<Long> recipeIds, List<Long> pinterestRecipeIds, List<Long> categoryIds, boolean aboutPage,
			@Nullable List<Long> menuIds) {

		static final Links NONE = new Links(List.of(), List.of(), List.of(), false, List.of());

		Links {
			menuIds = menuIds == null ? List.of() : menuIds;
		}

	}

}
