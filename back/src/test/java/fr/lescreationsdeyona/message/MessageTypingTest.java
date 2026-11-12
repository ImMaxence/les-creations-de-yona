package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.message.MessageResponses.Typist;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MessageTypingTest {

	private static final Set<String> MEMBERS = Set.of("yona@site.fr", "lea@site.fr");

	/** A clock the test moves forward. */
	private static final class Moving extends Clock {

		Instant now = Instant.parse("2026-11-12T10:00:00Z");

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}

	}

	private final Moving clock = new Moving();

	private MessageTyping typing() {
		AdminGroups groups = mock(AdminGroups.class);
		when(groups.audience(12, "yona@site.fr")).thenReturn(MEMBERS);
		when(groups.audience(12, "lea@site.fr")).thenReturn(MEMBERS);
		when(groups.audience(12, "autre@site.fr")).thenReturn(Set.of());
		return new MessageTyping(groups, clock);
	}

	@Test
	void tellsTheOthersWhoWritesForAFewSeconds() {
		MessageTyping typing = typing();

		assertThat(typing.writing(12, "Yona@site.fr", "Yona")).isEqualTo(MEMBERS);

		assertThat(typing.writers(12, "lea@site.fr")).containsExactly(new Typist("yona@site.fr", "Yona"));
		assertThat(typing.writers(12, "yona@site.fr")).isEmpty();
		clock.now = clock.now.plus(MessageTyping.SHOWN).plus(Duration.ofSeconds(1));
		assertThat(typing.writers(12, "lea@site.fr")).isEmpty();
	}

	@Test
	void keepsNothingFromAnAdminOutsideTheGroup() {
		MessageTyping typing = typing();

		assertThat(typing.writing(12, "autre@site.fr", "Autre")).isEmpty();

		assertThat(typing.writers(12, "lea@site.fr")).isEmpty();
	}

	@Test
	void stopsOnceTheMessageIsSent() {
		MessageTyping typing = typing();
		typing.writing(12, "yona@site.fr", "Yona");

		typing.sent(12, "Yona@site.fr");

		assertThat(typing.writers(12, "lea@site.fr")).isEmpty();
	}

}
