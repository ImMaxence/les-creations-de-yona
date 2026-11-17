package fr.lescreationsdeyona.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import fr.lescreationsdeyona.cap.CapPublished;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

class PushServiceTest {

	private final PushService service = new PushService(mock(JdbcClient.class), mock(WebPushKeys.class),
			JsonMapper.builder().build(), mock(AppBadge.class), "https://les-creations-de-yona.fr");

	@Test
	void sendsTheNumberOnTheIconBesideTheNotification() {
		Map<String, Object> notification = Map.of("title", "Boutique");

		assertThat(PushService.push(notification, Map.of("backOffice", 3L)))
			.containsEntry("notification", notification)
			.containsEntry("badge", Map.of("backOffice", 3L));
		// Not counted: the notification alone, which Angular's service worker shows as before
		assertThat(PushService.push(notification, null)).containsOnlyKeys("notification");
	}

	@Test
	void tellsANewArticleAsARecipe() {
		Map<String, Object> notification = PushService.notification(new CapPublished("Mon examen blanc", "/mon-cap/mon-examen-blanc", null, null));

		assertThat(notification).containsEntry("title", "Nouvel article : Mon examen blanc")
			.containsEntry("body", "À lire dans Mon CAP, sur Les créations de Yona")
			.doesNotContainKey("image")
			.containsEntry("data", Map.of("onActionClick",
					Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", "/mon-cap/mon-examen-blanc"))));
	}

	@Test
	void shortensTheSubtitleOfAnArticle() {
		UUID photo = UUID.randomUUID();
		Map<String, Object> notification = PushService.notification(new CapPublished("Mon examen blanc", "/mon-cap/mon-examen-blanc",
				" " + "Une longue journée ".repeat(10), photo));

		assertThat((String) notification.get("body")).hasSize(140).endsWith("…").doesNotStartWith(" ");
		assertThat(notification).containsEntry("image", "/api/images/" + photo + "/800.webp");
	}

	@Test
	void writesTheTestNotificationWithoutAFinalFullStop() {
		assertThat(PushService.testNotification()).containsEntry("title", "Notification de test")
			.containsEntry("body", "Les notifications fonctionnent sur cet appareil")
			.containsEntry("tag", "test");
	}

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
