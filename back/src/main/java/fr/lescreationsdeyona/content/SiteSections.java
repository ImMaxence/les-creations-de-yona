package fr.lescreationsdeyona.content;

import io.swagger.v3.oas.annotations.media.Schema;

/** The sections of the site that only show once they have something to show. */
public record SiteSections(
		@Schema(description = "\"Mon CAP\" has a published article") boolean capPublished,
		@Schema(description = "The shop is open to all: in the menu and on the home page (not while kept for the close ones)") boolean shopOpen) {
}
