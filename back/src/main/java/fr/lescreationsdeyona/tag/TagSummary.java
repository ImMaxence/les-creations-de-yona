package fr.lescreationsdeyona.tag;

import io.swagger.v3.oas.annotations.media.Schema;

/** A tag in a list, with the number of recipes carrying it. */
public record TagSummary(Long id, String name, String slug,
		@Schema(description = "Public list: published recipes only; back-office: drafts included") long recipeCount) {
}
