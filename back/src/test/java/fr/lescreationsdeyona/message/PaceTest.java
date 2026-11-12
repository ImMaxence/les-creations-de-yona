package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PaceTest {

	/** A clock the test moves forward. */
	private static final class Moving extends Clock {

		Instant now = Instant.parse("2026-11-12T10:00:00Z");

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}

	}

	@Test
	void letsAnAdminDoItSoManyTimesInTheWindowThenAgainOnceItSlides() {
		Moving clock = new Moving();
		Pace pace = new Pace(3, Duration.ofMinutes(10), clock);

		assertThat(pace.allow("yona@site.fr")).isTrue();
		assertThat(pace.allow("yona@site.fr")).isTrue();
		assertThat(pace.allow("yona@site.fr")).isTrue();
		assertThat(pace.allow("yona@site.fr")).isFalse();
		assertThat(pace.allow("lea@site.fr")).isTrue();

		clock.now = clock.now.plus(Duration.ofMinutes(10)).plusSeconds(1);
		assertThat(pace.allow("yona@site.fr")).isTrue();
	}

}
