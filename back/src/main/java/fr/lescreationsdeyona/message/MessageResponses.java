package fr.lescreationsdeyona.message;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What "Messages" sends and receives. */
public final class MessageResponses {

	private MessageResponses() {
	}

	/** A message of the group. */
	public record AdminMessage(long id, String authorEmail, @Nullable String authorName, @Nullable String authorPicture,
			@Schema(description = "The text; a mention is written in it: @[Tarte au citron](RECIPE:12)") String body,
			Instant sentAt) {
	}

	public record MessagePage(@Schema(description = "The latest first") List<AdminMessage> messages,
			@Schema(description = "Older ones to read, with before set to the id of the last one") boolean hasOlder) {
	}

	public record MessageForm(
			@Schema(description = "The text, mentions written in it: @[Tarte au citron](RECIPE:12)") @NotBlank @Size(max = AdminMessages.MAX_BODY) String body) {
	}

	/** A thing of the site a message may mention. */
	public record Mention(MentionKind kind, long id, String label) {
	}

	/** An admin of the group: every one allowed into the back-office. */
	public record GroupMember(String email,
			@Schema(description = "As Google gave it with their last message; absent before") @Nullable String name,
			@Nullable String picture) {
	}

}
