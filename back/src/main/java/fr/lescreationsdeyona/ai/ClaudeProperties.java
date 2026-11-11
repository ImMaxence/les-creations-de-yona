package fr.lescreationsdeyona.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Claude, Anthropic's AI: a third choice in the windows of the AI, next to Gemini and the local
 * model. Paid per use (no free tier): with Haiku, a recipe read costs about a tenth of a cent.
 *
 * @param apiKey created in the Claude Console (console.anthropic.com); blank: Claude is greyed out
 * @param model the model asked; Claude Haiku 5.5 unless told otherwise: quick and cheap, enough to sort a text
 * @param timeout one answer; stays under Cloudflare's 100 s
 */
@Validated
@ConfigurationProperties("app.claude")
public record ClaudeProperties(@Nullable String apiKey, @NotBlank String model, @NotNull Duration timeout) {

	boolean configured() {
		return apiKey != null && !apiKey.isBlank();
	}

}
