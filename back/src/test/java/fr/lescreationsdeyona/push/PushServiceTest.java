package fr.lescreationsdeyona.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

class PushServiceTest {

	private final PushService service = new PushService(mock(JdbcClient.class), mock(WebPushKeys.class),
			JsonMapper.builder().build(), "https://les-creations-de-yona.fr");

	@Test
	void takesTenNewSubscriptionsAnHourFromAnAddress() {
		Instant now = Instant.parse("2026-11-02T10:00:00Z");
		for (int i = 0; i < PushService.PER_HOUR; i++) {
			assertThat(service.refusal("1.2.3.4", now.plusSeconds(i))).isNull();
		}

		assertThat(service.refusal("1.2.3.4", now.plusSeconds(60))).isEqualTo(ErrorCode.PUSH_TOO_MANY);
		assertThat(service.refusal("5.6.7.8", now.plusSeconds(60))).isNull();
		assertThat(service.refusal("1.2.3.4", now.plus(Duration.ofMinutes(61)))).isNull();
	}

	@Test
	void takesThreeHundredNewSubscriptionsAnHourForTheWholeSite() {
		Instant now = Instant.parse("2026-11-02T10:00:00Z");
		for (int i = 0; i < PushService.SITE_PER_HOUR; i++) {
			assertThat(service.refusal("10.0." + i / 250 + "." + i % 250, now)).isNull();
		}

		assertThat(service.refusal("10.1.0.1", now.plusSeconds(30))).isEqualTo(ErrorCode.PUSH_BUSY);
		assertThat(service.refusal("10.1.0.1", now.plus(Duration.ofMinutes(61)))).isNull();
	}

	@Test
	void doesNotCountARefusedSubscriptionForTheSite() {
		Instant now = Instant.parse("2026-11-02T10:00:00Z");
		for (int i = 0; i < PushService.PER_HOUR * 3; i++) {
			service.refusal("1.2.3.4", now);
		}
		for (int i = 0; i < PushService.SITE_PER_HOUR - PushService.PER_HOUR; i++) {
			assertThat(service.refusal("10.0." + i / 250 + "." + i % 250, now)).isNull();
		}
	}

}
