package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.lescreationsdeyona.ai.Gemini.Failure;
import fr.lescreationsdeyona.ai.Gemini.GeminiException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class GeminiTest {

	private final JsonMapper json = JsonMapper.builder().build();

	@Test
	void tellsAKeyProblemFromAQuotaOrAnOutage() {
		assertThat(Gemini.classify(400, """
				{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT",
				"details":[{"reason":"API_KEY_INVALID"}]}}""")).isEqualTo(Failure.KEY_REFUSED);
		assertThat(Gemini.classify(429, """
				{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"violations":[
				{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}""")).isEqualTo(Failure.DAILY_QUOTA);
		assertThat(Gemini.classify(429, """
				{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"violations":[
				{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}]}}""")).isEqualTo(Failure.RATE_LIMITED);
		// Seen on 2026-10-28: "This model is currently experiencing high demand", and empty 404 pages
		assertThat(Gemini.classify(503, "{\"error\":{\"code\":503,\"status\":\"UNAVAILABLE\"}}")).isEqualTo(Failure.UNAVAILABLE);
		assertThat(Gemini.classify(404, "")).isEqualTo(Failure.UNAVAILABLE);
		assertThat(Gemini.classify(400, "{\"error\":{\"message\":\"Invalid JSON payload\"}}")).isEqualTo(Failure.BAD_RESPONSE);
	}

	@Test
	void readsTheAnswerWithoutTheModelsThoughts() throws GeminiException {
		String answer = Gemini.answerText(json.readTree("""
				{"candidates":[{"finishReason":"STOP","content":{"parts":[
				{"text":"thinking…","thought":true},{"text":"{\\"isRecipe\\":"},{"text":"true}"}]}}]}"""));

		assertThat(answer).isEqualTo("{\"isRecipe\":true}");
	}

	@Test
	void refusesABlockedOrCutAnswer() {
		assertThatThrownBy(() -> Gemini.answerText(json.readTree("{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}")))
			.isInstanceOf(GeminiException.class)
			.extracting("failure")
			.isEqualTo(Failure.BLOCKED);
		assertThatThrownBy(() -> Gemini.answerText(json.readTree("""
				{"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"{\\"title"}]}}]}""")))
			.isInstanceOf(GeminiException.class)
			.extracting("failure")
			.isEqualTo(Failure.BAD_RESPONSE);
	}

}
