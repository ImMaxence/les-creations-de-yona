package fr.lescreationsdeyona.ai;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Google Gemini, which fills a recipe in the back-office from a pasted text or a photo.
 *
 * @param apiKey created in Google AI Studio (free tier); blank: the feature is off, its button greyed out
 * @param models tried in order: the next one when a model is overloaded or out of its daily quota
 * @param timeout for each model; two models stay under Cloudflare's 100 s
 */
@Validated
@ConfigurationProperties("app.gemini")
public record GeminiProperties(@Nullable String apiKey, @NotEmpty List<String> models, @NotNull Duration timeout) {

	boolean configured() {
		return apiKey != null && !apiKey.isBlank();
	}

}
