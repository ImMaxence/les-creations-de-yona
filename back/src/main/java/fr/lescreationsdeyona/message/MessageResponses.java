package fr.lescreationsdeyona.message;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What "Messages" sends and receives. */
public final class MessageResponses {

	private MessageResponses() {
	}

	/** A message of a group. */
	public record AdminMessage(long id, long groupId, String authorEmail, @Nullable String authorName, @Nullable String authorPicture,
			@Schema(description = "The text, empty for photos alone; a mention is written in it: @[Tarte au citron](RECIPE:12)") String body,
			Instant sentAt, @Schema(description = "Its photos, in order: /api/admin/messages/images/{id}/800.webp") List<MessagePhoto> photos,
			@Schema(description = "The preview of its first link, once read on its page") @Nullable LinkPreview link) {
	}

	/** A photo of a message, its size to lay it out before it loads. */
	public record MessagePhoto(UUID id, int width, int height) {
	}

	/** The page a message links to, as it was when sent. */
	public record LinkPreview(String url, @Nullable String title, @Nullable String description, @Nullable String siteName,
			@Schema(description = "Its image: /api/admin/messages/images/{imageId}/800.webp") @Nullable UUID imageId,
			@Nullable Integer imageWidth, @Nullable Integer imageHeight) {
	}

	/** The page of a link being written, before sending: its image at /api/admin/messages/link-preview/image?url=. */
	public record LinkPage(String url, @Nullable String title, @Nullable String description, @Nullable String siteName,
			boolean image, @Nullable Integer imageWidth, @Nullable Integer imageHeight) {
	}

	public record MessagePage(@Schema(description = "The latest first") List<AdminMessage> messages,
			@Schema(description = "Older ones to read, with before set to the id of the last one") boolean hasOlder) {
	}

	public record MessageForm(@Schema(description = "The group it is written in") long groupId,
			@Schema(description = "The text, mentions written in it: @[Tarte au citron](RECIPE:12); empty with photos") @Nullable @Size(max = AdminMessages.MAX_BODY) String body,
			@Schema(description = "Photos sent before (POST /api/admin/messages/photos), in order") @Nullable @Size(max = AdminMessages.MAX_PHOTOS) List<@Valid @NotNull PhotoForm> photos,
			@Schema(description = "The preview of its first link left out, taken off by the writer") boolean withoutPreview) {
	}

	/** A photo sent before, with the size it was given back with. */
	public record PhotoForm(@NotNull UUID id, @Min(1) @Max(20000) int width, @Min(1) @Max(20000) int height) {
	}

	/** An admin writing in a group now: "est en train d'écrire…". */
	public record Typist(String email, @Nullable String name) {
	}

	/** Up to when a member read the group: the messages sent until then are seen by them ("Vu"). */
	public record GroupSeen(String email, Instant seenAt) {
	}

	/** A thing of the site a message may mention. */
	public record Mention(MentionKind kind, long id, String label) {
	}

	/** An admin: every one allowed into the back-office. */
	public record GroupMember(String email,
			@Schema(description = "As Google gave it with their last message; absent before") @Nullable String name,
			@Nullable String picture) {
	}

	/** A group the admin is in: its members, what came since their last visit, its last message. */
	public record MessageGroup(long id, String name, @Nullable UUID imageId,
			@Schema(description = "The group of all the admins: every one is in it, it cannot be left nor deleted") boolean everyone,
			@Schema(description = "Their emails, in lower case; every admin for the group of all") List<String> members,
			@Schema(description = "Messages of the others since this admin last read it") long unseen,
			@Schema(description = "This admin's last visit: what the others wrote after it is new") Instant since,
			@Nullable LastMessage last, Instant createdAt) {
	}

	/** The last message of a group, as the list of the groups shows it. */
	public record LastMessage(String authorEmail, @Nullable String authorName,
			@Schema(description = "The start of its text, mentions as \"@Tarte au citron\"; empty for photos alone") String text,
			int photos, Instant sentAt) {
	}

	public record GroupForm(@NotBlank @Size(max = AdminGroups.MAX_NAME) String name,
			@Schema(description = "The emails of its members; the admin creating it is one of them anyway. Ignored for the group of all")
			@Nullable @Size(max = 50) List<@NotBlank @Size(max = 320) String> members) {
	}

}
