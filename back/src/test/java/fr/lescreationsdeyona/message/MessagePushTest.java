package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MessagePushTest {

	private static MessageSent sent(String authorName, String body, int photos) {
		return new MessageSent(42, 12, "Boutique", "lea@site.fr", authorName, body, photos, Instant.parse("2026-11-12T10:00:00Z"),
				Set.of("lea@site.fr", "yona@site.fr", "sam@site.fr"));
	}

	@Test
	void tellsTheGroupThenWhoWroteWhat() {
		Map<String, Object> notification = MessagePush.notification(sent("Léa Martin", "On voit @[Tarte au citron](RECIPE:12) demain ?", 0));

		assertThat(notification).containsEntry("title", "Boutique")
			.containsEntry("body", "Léa : On voit @Tarte au citron demain ?")
			.containsEntry("tag", "messages-12")
			.containsEntry("renotify", true)
			.containsEntry("data", Map.of("onActionClick",
					Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", "/admin/messages?groupe=12"))));
	}

	@Test
	void saysThePhotosOfAMessageWithoutTextAndTheEmailWithoutAName() {
		assertThat(MessagePush.notification(sent(null, "", 1))).containsEntry("body", "lea@site.fr : Une photo");
		assertThat(MessagePush.notification(sent("Léa", "", 3))).containsEntry("body", "Léa : 3 photos");
	}

	@Test
	void tellsTheMembersWhoHaveNotReadItButTheAuthor() {
		assertThat(MessagePush.unread(Set.of("lea@site.fr", "Yona@site.fr", "sam@site.fr"), "lea@site.fr", Set.of("sam@site.fr")))
			.containsExactly("yona@site.fr");
		assertThat(MessagePush.unread(Set.of("lea@site.fr", "sam@site.fr"), "lea@site.fr", Set.of("sam@site.fr"))).isEmpty();
	}

}
