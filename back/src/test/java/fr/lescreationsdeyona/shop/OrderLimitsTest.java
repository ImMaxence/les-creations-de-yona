package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrderLimitsTest {

	private static final Instant NOW = Instant.parse("2026-11-09T10:00:00Z");

	private final OrderLimits limits = new OrderLimits();

	@Test
	void limitsAnAddressToOneOrderAMinute() {
		assertThat(limits.refusal("1.2.3.4", NOW)).isNull();

		assertThat(limits.refusal("1.2.3.4", NOW.plusSeconds(30))).isEqualTo(ErrorCode.SHOP_TOO_FAST);
		assertThat(limits.refusal("1.2.3.4", NOW.plus(Duration.ofMinutes(2)))).isNull();
	}

	@Test
	void limitsAnAddressByTheHour() {
		for (int order = 0; order < OrderLimits.PER_HOUR; order++) {
			assertThat(limits.refusal("1.2.3.4", NOW.plus(Duration.ofMinutes(2L * order)))).isNull();
		}

		assertThat(limits.refusal("1.2.3.4", NOW.plus(Duration.ofMinutes(30)))).isEqualTo(ErrorCode.SHOP_TOO_MANY);
		assertThat(limits.refusal("1.2.3.4", NOW.plus(Duration.ofMinutes(70)))).isNull();
	}

	@Test
	void limitsTheWholeSite() {
		for (int order = 0; order < OrderLimits.SITE_PER_HOUR; order++) {
			assertThat(limits.refusal("address-" + order, NOW)).isNull();
		}

		assertThat(limits.refusal("another", NOW)).isEqualTo(ErrorCode.SHOP_BUSY);
	}

	@Test
	void limitsTheQuestionsToGoogle() {
		for (int check = 0; check < OrderLimits.CHECKS_PER_HOUR; check++) {
			assertThat(limits.tooManyChecks("1.2.3.4", NOW)).isFalse();
		}

		assertThat(limits.tooManyChecks("1.2.3.4", NOW)).isTrue();
		assertThat(limits.tooManyChecks("5.6.7.8", NOW)).isFalse();
	}

}
