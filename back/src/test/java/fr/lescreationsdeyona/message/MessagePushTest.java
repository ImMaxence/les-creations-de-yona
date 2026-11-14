package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
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

	private static LineWritten line(GroupEvent event, String value) {
		return new LineWritten(43, 12, "Boutique", event, value, "lea@site.fr", "Léa Martin", Instant.parse("2026-11-12T10:00:00Z"),
				Set.of("lea@site.fr", "yona@site.fr", "sam@site.fr"));
	}

	@Test
	void tellsTheLinesOfTheGroupAsTheReaderReadsThem() {
		LineWritten added = line(GroupEvent.ADDED, "Sam@site.fr");
		assertThat(MessagePush.concerned(added)).isEqualTo("sam@site.fr");
		assertThat(MessagePush.notification(added, "Léa", "Sam", true)).containsEntry("title", "Boutique")
			.containsEntry("body", "Léa vous a ajouté au groupe")
			.containsEntry("tag", "messages-12");
		assertThat(MessagePush.notification(added, "Léa", "Sam", false)).containsEntry("body", "Léa a ajouté Sam");
		assertThat(MessagePush.notification(line(GroupEvent.RENAMED, "Atelier"), "Léa", null, false))
			.containsEntry("body", "Léa a renommé le groupe « Atelier »");
		assertThat(MessagePush.notification(line(GroupEvent.LEFT, null), "Léa", null, false)).containsEntry("body", "Léa a quitté le groupe");
		// Removed, the member is sent to the messages page: the group is no longer theirs
		assertThat(MessagePush.notification(line(GroupEvent.REMOVED, "sam@site.fr"), "Léa", "Sam", true))
			.containsEntry("body", "Léa vous a retiré du groupe")
			.containsEntry("data", Map.of("onActionClick",
					Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", "/admin/messages"))));
	}

	@Test
	void tellsANewVersionWrittenByTheSite() {
		LineWritten version = new LineWritten(44, 1, "Tous les admins", GroupEvent.VERSION, "2.18.0", VersionAnnouncement.SITE, null,
				Instant.parse("2026-11-14T10:00:00Z"), Set.of("lea@site.fr", "yona@site.fr"));

		assertThat(MessagePush.concerned(version)).isNull();
		assertThat(MessagePush.notification(version, "site", null, false)).containsEntry("title", "Tous les admins")
			.containsEntry("body", "Nouvelle version de l'application disponible : version 2.18.0");
		// The site is no admin: every one of them is told
		assertThat(MessagePush.unread(version.members(), version.actorEmail(), Set.of())).containsExactly("lea@site.fr", "yona@site.fr");
	}

	@Test
	void tellsTheMemberConcernedAlwaysAndTheOthersForTheLastLineOnly() {
		List<String> unread = List.of("sam@site.fr", "yona@site.fr");

		assertThat(MessagePush.audiences(unread, "sam@site.fr", true))
			.isEqualTo(new MessagePush.Audiences(List.of("sam@site.fr"), List.of("yona@site.fr")));
		assertThat(MessagePush.audiences(unread, "sam@site.fr", false))
			.isEqualTo(new MessagePush.Audiences(List.of("sam@site.fr"), List.of()));
		assertThat(MessagePush.audiences(unread, null, true)).isEqualTo(new MessagePush.Audiences(List.of(), unread));
		// Read already: not told
		assertThat(MessagePush.audiences(List.of("yona@site.fr"), "sam@site.fr", true))
			.isEqualTo(new MessagePush.Audiences(List.of(), List.of("yona@site.fr")));
		assertThat(MessagePush.firstName("  ", "lea@site.fr")).isEqualTo("lea@site.fr");
	}

}
