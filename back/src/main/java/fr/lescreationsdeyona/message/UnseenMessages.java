package fr.lescreationsdeyona.message;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/**
 * The messages of the others an admin has not read yet: the badge of "Messages", and the latest of them, shown in a
 * toast at the top right of every page of the back-office as it comes (2.17).
 */
public record UnseenMessages(long count,
		@Schema(description = "Since when it counts: the last visit, or 7 days ago the first time") Instant since,
		@Schema(description = "The latest of them; absent without any") @Nullable Latest latest) {

	/** As a chat tells it: who, in which group, the start of what they wrote. */
	@Schema(name = "UnseenMessage")
	public record Latest(long id, long groupId, String groupName,
			@Schema(description = "As their Google account says it, their email otherwise") String authorName,
			@Schema(description = "Their photo, from their Google account; absent without") @Nullable String authorPicture,
			@Schema(description = "Its start as plain text (mentions written out, no Markdown), 140 characters at most; empty for "
					+ "photos alone") String text,
			int photos, Instant sentAt) {

		static final int EXCERPT = 140;

		static Latest of(long id, long groupId, String groupName, String authorEmail, @Nullable String authorName,
				@Nullable String authorPicture, String body, int photos, Instant sentAt) {
			return new Latest(id, groupId, groupName, authorName == null || authorName.isBlank() ? authorEmail : authorName.strip(),
					authorPicture, MessageTexts.excerpt(MessageTexts.readable(body), EXCERPT), photos, sentAt);
		}

	}

}
