package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.live.AdminLive;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AdminPresenceTest {

	private final AdminLive live = mock(AdminLive.class);

	private Instant now = Instant.parse("2026-11-12T10:00:00Z");

	private final AdminPresence presence = new AdminPresence(live, new Clock() {

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneOffset getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(java.time.ZoneId zone) {
			return this;
		}

	});

	@Test
	void anAdminWithAPageOpenIsThere() {
		when(live.online()).thenReturn(Set.of("yona@site.fr", "lea@site.fr"));

		assertThat(presence.online()).containsExactly("lea@site.fr", "yona@site.fr");
	}

	@Test
	void withoutWebSocketThereAMinuteAfterTheLastWordOfItsPage() {
		when(live.online()).thenReturn(Set.of());

		presence.seen("Sam@site.fr");
		assertThat(presence.online()).containsExactly("sam@site.fr");

		now = now.plus(Duration.ofSeconds(50));
		presence.seen("sam@site.fr");
		now = now.plus(Duration.ofSeconds(50));
		assertThat(presence.online()).containsExactly("sam@site.fr");

		now = now.plus(Duration.ofSeconds(20));
		assertThat(presence.online()).isEmpty();
	}

	@Test
	void theOthersAreToldOnlyOfAnArrival() {
		when(live.online()).thenReturn(Set.of("yona@site.fr"));

		presence.seen("sam@site.fr");
		presence.seen("sam@site.fr");
		presence.seen("yona@site.fr");

		verify(live, times(1)).tellPresence();
	}

	@Test
	void anAdminAlreadyThereByItsWebSocketIsNotAnnouncedAgain() {
		when(live.online()).thenReturn(Set.of("yona@site.fr"));

		presence.seen("Yona@site.fr");

		verify(live, never()).tellPresence();
	}

}
