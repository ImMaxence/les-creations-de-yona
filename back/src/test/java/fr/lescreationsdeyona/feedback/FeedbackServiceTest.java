package fr.lescreationsdeyona.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class FeedbackServiceTest {

	private final FeedbackRepository repository = mock(FeedbackRepository.class);

	private final FeedbackService service = new FeedbackService(repository, mock(AuditLog.class));

	@Test
	void keepsTheMessageTrimmedWithoutABlankEmail() {
		service.submit(new FeedbackForm("  Super site !  ", " ", "/recettes", null), "1.2.3.4");

		ArgumentCaptor<Feedback> saved = ArgumentCaptor.forClass(Feedback.class);
		verify(repository).save(saved.capture());
		assertThat(saved.getValue().getMessage()).isEqualTo("Super site !");
		assertThat(saved.getValue().getEmail()).isNull();
		assertThat(saved.getValue().getPage()).isEqualTo("/recettes");
	}

	@Test
	void ignoresARobotFillingTheHiddenField() {
		service.submit(new FeedbackForm("Buy now", null, null, "https://spam.example"), "1.2.3.4");

		verify(repository, never()).save(any());
	}

	@Test
	void takesFiveMessagesAnHourFromAnAddress() {
		Instant now = Instant.parse("2026-10-28T10:00:00Z");
		for (int message = 0; message < FeedbackService.PER_HOUR; message++) {
			assertThat(service.allow("1.2.3.4", now.plusSeconds(message))).isTrue();
		}

		assertThat(service.allow("1.2.3.4", now.plusSeconds(60))).isFalse();
		assertThat(service.allow("5.6.7.8", now.plusSeconds(60))).isTrue();
		assertThat(service.allow("1.2.3.4", now.plus(Duration.ofMinutes(61)))).isTrue();
	}

	@Test
	void stopsAtFiveHundredUnreadMessages() {
		when(repository.countByReadAtIsNull()).thenReturn((long) FeedbackService.MAX_UNREAD);

		assertThatThrownBy(() -> service.submit(new FeedbackForm("Bonjour", null, null, null), "1.2.3.4"))
			.extracting("code")
			.isEqualTo(ErrorCode.FEEDBACK_FULL);
	}

}
