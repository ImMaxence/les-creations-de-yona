package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * The AIs called by the backend, Gemini (free) or Claude (paid): the same instructions, the same
 * schema, the same checks of the answer; only who answers changes. Their failures become the
 * errors shown in the back-office, a refused key being remembered to grey the choice out.
 */
@Component
class OnlineAi {

	private final Gemini gemini;

	private final GeminiStatus geminiStatus;

	private final Claude claude;

	private final ClaudeStatus claudeStatus;

	OnlineAi(Gemini gemini, GeminiStatus geminiStatus, Claude claude, ClaudeStatus claudeStatus) {
		this.gemini = gemini;
		this.geminiStatus = geminiStatus;
		this.claude = claude;
		this.claudeStatus = claudeStatus;
	}

	/** Checked before anything is sent: a choice that cannot work says so at once. */
	void checkConfigured(AiEngine engine) {
		if (engine == AiEngine.CLAUDE ? !claude.configured() : !gemini.configured()) {
			throw new ApiException(engine == AiEngine.CLAUDE ? ErrorCode.CLAUDE_NOT_CONFIGURED : ErrorCode.AI_NOT_CONFIGURED);
		}
	}

	/** The JSON answered by the AI chosen. */
	String generate(AiEngine engine, String instructions, String text, Gemini.@Nullable Image image, Map<String, Object> schema) {
		checkConfigured(engine);
		try {
			return engine == AiEngine.CLAUDE ? claude.generate(instructions, text, image, schema)
					: gemini.generate(instructions, text, image, schema);
		} catch (Gemini.GeminiException e) {
			throw new ApiException(geminiStatus.failed(e.failure));
		} catch (Claude.ClaudeException e) {
			throw new ApiException(claudeStatus.failed(e.failure));
		}
	}

	RecipeAiStatus geminiStatus() {
		return geminiStatus.current();
	}

	RecipeAiStatus claudeStatus() {
		return claudeStatus.current();
	}

	/** "Claude Haiku 5.5": shown in the window, from the model configured. */
	String claudeModel() {
		return claude.model();
	}

}
