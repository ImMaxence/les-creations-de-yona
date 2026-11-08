package fr.lescreationsdeyona.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class RecaptchaTest {

	private final Recaptcha recaptcha = new Recaptcha("site", "secret", JsonMapper.builder().build());

	@Test
	void acceptsWhatGoogleValidated() {
		assertThat(recaptcha.successful("{\"success\":true,\"hostname\":\"les-creations-de-yona.fr\"}")).isTrue();
	}

	@Test
	void refusesWhatGoogleRefused() {
		assertThat(recaptcha.successful("{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}")).isFalse();
		assertThat(recaptcha.successful("{\"success\":false,\"error-codes\":[\"invalid-input-secret\"]}")).isFalse();
	}

	@Test
	void refusesAnUnreadableAnswer() {
		assertThat(recaptcha.successful("<html>erreur</html>")).isFalse();
		assertThat(recaptcha.successful("{}")).isFalse();
	}

}
