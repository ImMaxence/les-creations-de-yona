package fr.lescreationsdeyona.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class FeedbackCaptchaTest {

	private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");

	private final FeedbackCaptcha captcha = new FeedbackCaptcha();

	@Test
	void acceptsASolvedChallenge() {
		String token = captcha.challenge(NOW).token();

		assertThat(captcha.accepts(token, solve(token), NOW.plusSeconds(5))).isTrue();
	}

	@Test
	void acceptsAChallengeOnce() {
		String token = captcha.challenge(NOW).token();
		String solution = solve(token);

		assertThat(captcha.accepts(token, solution, NOW)).isTrue();
		assertThat(captcha.accepts(token, solution, NOW)).isFalse();
	}

	@Test
	void refusesAWrongSolution() {
		String token = captcha.challenge(NOW).token();

		assertThat(captcha.accepts(token, wrong(token), NOW)).isFalse();
	}

	@Test
	void refusesAnExpiredChallenge() {
		String token = captcha.challenge(NOW).token();

		assertThat(captcha.accepts(token, solve(token), NOW.plus(FeedbackCaptcha.VALID).plus(Duration.ofSeconds(1)))).isFalse();
	}

	@Test
	void refusesAChallengeSignedElsewhere() {
		String token = new FeedbackCaptcha().challenge(NOW).token();

		assertThat(captcha.accepts(token, solve(token), NOW)).isFalse();
	}

	@Test
	void refusesAForgedOrMissingToken() {
		assertThat(captcha.accepts(null, "1", NOW)).isFalse();
		assertThat(captcha.accepts("abc", "1", NOW)).isFalse();
		assertThat(captcha.accepts("not-a-date.salt.signature", "1", NOW)).isFalse();
	}

	@Test
	void countsTheLeadingZeroBits() {
		assertThat(FeedbackCaptcha.leadingZeroBits(new byte[] { 0, 0x10, 0 })).isEqualTo(11);
		assertThat(FeedbackCaptcha.leadingZeroBits(new byte[] { (byte) 0x80 })).isZero();
		assertThat(FeedbackCaptcha.leadingZeroBits(new byte[] { 0, 0 })).isEqualTo(16);
	}

	private static String solve(String token) {
		for (long solution = 0;; solution++) {
			if (zeroBits(token, solution) >= FeedbackCaptcha.DIFFICULTY) {
				return Long.toString(solution);
			}
		}
	}

	private static String wrong(String token) {
		for (long solution = 0;; solution++) {
			if (zeroBits(token, solution) < FeedbackCaptcha.DIFFICULTY) {
				return Long.toString(solution);
			}
		}
	}

	private static int zeroBits(String token, long solution) {
		return FeedbackCaptcha.leadingZeroBits(FeedbackCaptcha.sha256(token + ":" + solution));
	}

}
