package fr.lescreationsdeyona.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class FeedbackServiceTest {

	private final FeedbackRepository repository = mock(FeedbackRepository.class);

	private final Recaptcha captcha = mock(Recaptcha.class);

	private final FeedbackService service = new FeedbackService(repository, mock(AuditLog.class), captcha,
			mock(ApplicationEventPublisher.class));

	@BeforeEach
	void passTheCaptcha() {
		when(captcha.accepts(any())).thenReturn(true);
	}

	@Test
	void keepsTheMessageTrimmedWithoutABlankEmail() {
		service.submit(form("  Super site !  ", " ", "/recettes", null), "1.2.3.4");

		ArgumentCaptor<Feedback> saved = ArgumentCaptor.forClass(Feedback.class);
		verify(repository).save(saved.capture());
		assertThat(saved.getValue().getMessage()).isEqualTo("Super site !");
		assertThat(saved.getValue().getEmail()).isNull();
		assertThat(saved.getValue().getPage()).isEqualTo("/recettes");
	}

	@Test
	void ignoresARobotFillingTheHiddenField() {
		service.submit(form("Buy now", null, null, "https://spam.example"), "1.2.3.4");

		verify(repository, never()).save(any());
	}

	@Test
	void refusesAMessageWithoutASolvedCaptcha() {
		when(captcha.accepts(any())).thenReturn(false);

		assertThatThrownBy(() -> service.submit(form("Bonjour", null, null, null), "1.2.3.4"))
			.extracting("code")
			.isEqualTo(ErrorCode.FEEDBACK_CAPTCHA);
		verify(repository, never()).save(any());
	}

	@Test
	void doesNotAskGoogleWithoutAnAnswer() {
		assertThatThrownBy(() -> service.submit(new FeedbackForm("Bonjour", null, null, null, " "), "1.2.3.4"))
			.extracting("code")
			.isEqualTo(ErrorCode.FEEDBACK_CAPTCHA);
		verify(captcha, never()).accepts(any());
	}

	@Test
	void limitsTheQuestionsToGoogleFromAnAddress() {
		when(captcha.accepts(any())).thenReturn(false);
		for (int attempt = 0; attempt < FeedbackService.CHECKS_PER_HOUR; attempt++) {
			assertThatThrownBy(() -> service.submit(form("Bonjour", null, null, null), "1.2.3.4"))
				.extracting("code")
				.isEqualTo(ErrorCode.FEEDBACK_CAPTCHA);
		}

		assertThatThrownBy(() -> service.submit(form("Bonjour", null, null, null), "1.2.3.4"))
			.extracting("code")
			.isEqualTo(ErrorCode.FEEDBACK_TOO_MANY);
		verify(captcha, times(FeedbackService.CHECKS_PER_HOUR)).accepts(any());
	}

	@Test
	void takesFiveMessagesAnHourFromAnAddress() {
		Instant now = Instant.parse("2026-10-28T10:00:00Z");
		for (int message = 0; message < FeedbackService.PER_HOUR; message++) {
			assertThat(service.refusal("1.2.3.4", now.plus(Duration.ofMinutes(2L * message)))).isNull();
		}

		assertThat(service.refusal("1.2.3.4", now.plus(Duration.ofMinutes(12)))).isEqualTo(ErrorCode.FEEDBACK_TOO_MANY);
		assertThat(service.refusal("5.6.7.8", now.plus(Duration.ofMinutes(12)))).isNull();
		assertThat(service.refusal("1.2.3.4", now.plus(Duration.ofMinutes(61)))).isNull();
	}

	@Test
	void waitsAMinuteBetweenTwoMessagesOfAnAddress() {
		Instant now = Instant.parse("2026-10-28T10:00:00Z");

		assertThat(service.refusal("1.2.3.4", now)).isNull();
		assertThat(service.refusal("1.2.3.4", now.plusSeconds(5))).isEqualTo(ErrorCode.FEEDBACK_TOO_FAST);
		assertThat(service.refusal("1.2.3.4", now.plusSeconds(61))).isNull();
	}

	@Test
	void takesThirtyMessagesAnHourForTheWholeSite() {
		Instant now = Instant.parse("2026-10-28T10:00:00Z");
		for (int sender = 0; sender < FeedbackService.SITE_PER_HOUR; sender++) {
			assertThat(service.refusal("10.0.0." + sender, now.plusSeconds(sender))).isNull();
		}

		// 40 messages at once from 40 addresses: the last ones wait
		assertThat(service.refusal("10.0.1.1", now.plusSeconds(40))).isEqualTo(ErrorCode.FEEDBACK_BUSY);
		assertThat(service.refusal("10.0.1.1", now.plus(Duration.ofMinutes(61)))).isNull();
	}

	@Test
	void keepsTheSameMessageOnce() {
		service.submit(form("Super   site !", null, null, null), "1.2.3.4");
		service.submit(form("super site !", null, null, null), "5.6.7.8");

		verify(repository, times(1)).save(any());
	}

	@Test
	void stopsAtFiveHundredUnreadMessages() {
		when(repository.countByReadAtIsNull()).thenReturn((long) FeedbackService.MAX_UNREAD);

		assertThatThrownBy(() -> service.submit(form("Bonjour", null, null, null), "1.2.3.4"))
			.extracting("code")
			.isEqualTo(ErrorCode.FEEDBACK_FULL);
	}

	private static FeedbackForm form(String message, String email, String page, String website) {
		return new FeedbackForm(message, email, page, website, "token");
	}

}
