package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.error.ErrorCode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ClaudeTest {

	private final Gemini gemini = mock(Gemini.class);

	private final Claude claude = mock(Claude.class);

	private final OnlineAi onlineAi = new OnlineAi(gemini, new GeminiStatus(gemini), claude, new ClaudeStatus(claude));

	@Test
	@SuppressWarnings("unchecked")
	void closesEveryObjectAndWritesNullableTypesAsAnyOf() {
		Map<String, Object> strict = Claude.strict(RecipeAiPrompt.schema());

		assertThat(strict).containsEntry("additionalProperties", false);
		Map<String, Object> properties = (Map<String, Object>) strict.get("properties");
		assertThat(properties.get("title")).isEqualTo(Map.of("anyOf", List.of(Map.of("type", "string"), Map.of("type", "null"))));
		Map<String, Object> parts = (Map<String, Object>) properties.get("parts");
		assertThat((Map<String, Object>) parts.get("items")).containsEntry("additionalProperties", false);
		// A nullable object: its object side closed too
		Map<String, Object> mold = (Map<String, Object>) properties.get("mold");
		List<Map<String, Object>> sides = (List<Map<String, Object>>) mold.get("anyOf");
		assertThat(sides.getFirst()).containsEntry("type", "object").containsEntry("additionalProperties", false);
		assertThat(sides.getLast()).isEqualTo(Map.of("type", "null"));
	}

	@Test
	void leavesTheSchemaOfTheArticlesValidToo() {
		String json = JsonMapper.builder().build().writeValueAsString(Claude.strict(CapAiPrompt.schema()));

		assertThat(json).doesNotContain("[\"string\",\"null\"]").contains("\"additionalProperties\":false");
	}

	@Test
	void asksForAFallbackOnlyFromTheModelsThatHaveOne() {
		assertThat(Claude.hasFallbacks("claude-haiku-5-5")).isFalse();
		assertThat(Claude.hasFallbacks("claude-sonnet-5-5")).isTrue();
		assertThat(Claude.hasFallbacks("claude-opus-5-5")).isTrue();
		assertThat(Claude.hasFallbacks("claude-fable-5-2")).isTrue();
	}

	@Test
	void readsTheStatusOfAnAnswer() {
		assertThat(Claude.classify(401)).isEqualTo(Claude.Failure.KEY_REFUSED);
		assertThat(Claude.classify(402)).isEqualTo(Claude.Failure.NO_CREDIT);
		assertThat(Claude.classify(429)).isEqualTo(Claude.Failure.RATE_LIMITED);
		assertThat(Claude.classify(529)).isEqualTo(Claude.Failure.UNAVAILABLE);
		assertThat(Claude.classify(404)).isEqualTo(Claude.Failure.BAD_RESPONSE);
	}

	@Test
	void greysClaudeOutWithoutAKey() {
		assertThat(onlineAi.claudeStatus().available()).isFalse();
		assertThatThrownBy(() -> onlineAi.generate(AiEngine.CLAUDE, "i", "t", null, Map.of())).extracting("code")
			.isEqualTo(ErrorCode.CLAUDE_NOT_CONFIGURED);
		verifyNoInteractions(gemini);
	}

	@Test
	void remembersAnAccountWithoutCredit() throws Exception {
		when(claude.configured()).thenReturn(true);
		when(claude.generate(anyString(), anyString(), any(), any()))
			.thenThrow(new Claude.ClaudeException(Claude.Failure.UNAVAILABLE, "HTTP 529"))
			.thenThrow(new Claude.ClaudeException(Claude.Failure.NO_CREDIT, "credit balance is too low"));

		assertThatThrownBy(() -> onlineAi.generate(AiEngine.CLAUDE, "i", "t", null, Map.of())).extracting("code")
			.isEqualTo(ErrorCode.CLAUDE_UNAVAILABLE);
		assertThat(onlineAi.claudeStatus().available()).isTrue();
		assertThatThrownBy(() -> onlineAi.generate(AiEngine.CLAUDE, "i", "t", null, Map.of())).extracting("code")
			.isEqualTo(ErrorCode.CLAUDE_NO_CREDIT);
		assertThat(onlineAi.claudeStatus().reason()).isEqualTo(ErrorCode.CLAUDE_NO_CREDIT.message());
	}

	@Test
	void asksClaudeWhenChosen() throws Exception {
		when(claude.configured()).thenReturn(true);
		when(claude.generate(anyString(), anyString(), any(), any())).thenReturn("{\"ok\":true}");

		assertThat(onlineAi.generate(AiEngine.CLAUDE, "i", "t", null, Map.of())).isEqualTo("{\"ok\":true}");
		verifyNoInteractions(gemini);
	}

}
