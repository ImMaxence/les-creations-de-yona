package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Whether Gemini can be used now, for the recipes and for the articles of "Mon CAP" alike: no key,
 * a key refused, or every model out of its daily quota grey the buttons out.
 */
@Component
class GeminiStatus {

	/** A refused key is checked again after that, in case it was fixed. */
	private static final Duration KEY_CHECK_VALIDITY = Duration.ofMinutes(10);

	private final Gemini gemini;

	private volatile boolean keyRefused;

	private volatile @Nullable Instant keyCheckedAt;

	GeminiStatus(Gemini gemini) {
		this.gemini = gemini;
	}

	/** Asked when an editor opens; uses none of Gemini's quota. */
	RecipeAiStatus current() {
		if (!gemini.configured()) {
			return new RecipeAiStatus(false, ErrorCode.AI_NOT_CONFIGURED.message(), null);
		}
		Instant checkedAt = keyCheckedAt;
		if (checkedAt == null || checkedAt.plus(KEY_CHECK_VALIDITY).isBefore(Instant.now())) {
			Gemini.KeyCheck check = gemini.checkKey();
			// Google not answering says nothing about the key: the button stays usable
			if (check != Gemini.KeyCheck.UNKNOWN) {
				keyRefused = check == Gemini.KeyCheck.REFUSED;
				keyCheckedAt = Instant.now();
			}
		}
		if (keyRefused) {
			return new RecipeAiStatus(false, ErrorCode.AI_KEY_REFUSED.message(), null);
		}
		Optional<Instant> exhaustedUntil = gemini.exhaustedUntil();
		return exhaustedUntil
			.map(until -> new RecipeAiStatus(false, ErrorCode.AI_DAILY_QUOTA.message(), until))
			.orElseGet(() -> new RecipeAiStatus(true, null, null));
	}

	/** What Gemini answered, as an error for the back-office; a refused key is remembered. */
	ErrorCode failed(Gemini.Failure failure) {
		if (failure == Gemini.Failure.KEY_REFUSED) {
			keyRefused = true;
			keyCheckedAt = Instant.now();
		}
		return switch (failure) {
			case KEY_REFUSED -> ErrorCode.AI_KEY_REFUSED;
			case DAILY_QUOTA -> ErrorCode.AI_DAILY_QUOTA;
			case RATE_LIMITED -> ErrorCode.AI_RATE_LIMITED;
			case UNAVAILABLE -> ErrorCode.AI_UNAVAILABLE;
			case BLOCKED -> ErrorCode.AI_BLOCKED;
			case BAD_RESPONSE -> ErrorCode.AI_BAD_RESPONSE;
		};
	}

}
