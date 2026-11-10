package fr.lescreationsdeyona.image;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
	 * {@code menuIds}: absent from the photos put in the trash before 1.7; {@code capEntryIds}: before 2.0;
	 * {@code shopProductIds}: before 2.4. The articles showing it in their blocks keep its id: it comes
	 * back there by itself. The observations of the photos trashed before 2.4 are left: they are articles now.
	 */
	@JsonIgnoreProperties(ignoreUnknown = true)
	record Links(List<Long> recipeIds, List<Long> pinterestRecipeIds, List<Long> categoryIds, boolean aboutPage,
			@Nullable List<Long> menuIds, @Nullable List<Long> capEntryIds, @Nullable List<Long> shopProductIds) {

		static final Links NONE = new Links(List.of(), List.of(), List.of(), false, List.of(), List.of(), List.of());

		Links {
			menuIds = menuIds == null ? List.of() : menuIds;
			capEntryIds = capEntryIds == null ? List.of() : capEntryIds;
			shopProductIds = shopProductIds == null ? List.of() : shopProductIds;
		}

	}

}
