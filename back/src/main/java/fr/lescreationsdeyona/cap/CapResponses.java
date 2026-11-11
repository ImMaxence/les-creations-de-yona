package fr.lescreationsdeyona.cap;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the API answers about "Mon CAP". */
public final class CapResponses {

	private CapResponses() {
	}

	/** An article in the timeline, without its blocks. */
	public record CapArticleCard(Long id, String title, @Nullable String subtitle,
			@Schema(description = "Its page: /mon-cap/{slug}") String slug, LocalDate happenedOn, @Nullable UUID imageId,
			CapStyle style,
			@Schema(description = "The start of its text, without Markdown, cut at a word; absent without text") @Nullable String excerpt) {
	}

	/** An article as visitors read it: its empty blocks and the photos gone from the gallery left out. */
	public record CapArticle(Long id, String title, @Nullable String subtitle, String slug, LocalDate happenedOn,
			@Nullable UUID imageId, CapStyle style, List<CapBlock> blocks,
			@Schema(description = "The start of its text, for search engines") @Nullable String excerpt, Instant updatedAt) {
	}

	/** The article put forward on the home page. */
	public record CapHighlight(CapArticleCard article,
			@Schema(description = "Chosen with \"Mettre en avant\"; false for the latest article") boolean featured) {
	}

	public record AdminCapEntrySummary(Long id, String title, @Nullable String subtitle, String slug, LocalDate happenedOn,
			@Nullable UUID imageId, CapStyle style, int blockCount, CapStatus status,
			@Schema(description = "A draft: published by the site then (\"Programmé\"); a failed one: when it should have been") @Nullable Instant scheduledAt,
			@Schema(description = "Why a failed article was not published") @Nullable String publicationFailure, boolean featured,
			Instant updatedAt) {
	}

	/** In the editor: every block, half-filled ones too. */
	public record AdminCapEntry(Long id, String title, @Nullable String subtitle, String slug, LocalDate happenedOn,
			@Nullable UUID imageId, CapStyle style, List<CapBlock> blocks, CapStatus status, @Nullable Instant scheduledAt,
			@Nullable String publicationFailure, boolean featured, Instant updatedAt) {
	}

	/**
	 * An article in the trash, as JSON: its photo is kept beside it. {@code body}: the text of a step trashed
	 * before the articles (2.4), or of an observation; it then becomes its Text block.
	 */
	record TrashedCapEntry(String title, @Nullable String subtitle, @Nullable String slug, @Nullable String body,
			LocalDate happenedOn, @Nullable CapStyle style, @Nullable List<CapBlock> blocks, boolean published) {
	}

}
