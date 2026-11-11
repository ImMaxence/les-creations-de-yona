package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Whether Claude can be used now: no key, or a key refused or out of credit at the last try, grey it
 * out for 10 minutes (then it is tried again, in case it was fixed). Nothing is asked to Anthropic
 * to tell: each question is paid.
 */
@Component
class ClaudeStatus {

	private static final Duration REMEMBERED = Duration.ofMinutes(10);

	private final Claude claude;

	private volatile @Nullable ErrorCode lastingProblem;

	private volatile Instant problemAt = Instant.EPOCH;

	ClaudeStatus(Claude claude) {
		this.claude = claude;
	}

	RecipeAiStatus current() {
		if (!claude.configured()) {
			return new RecipeAiStatus(false, ErrorCode.CLAUDE_NOT_CONFIGURED.message(), null);
		}
		ErrorCode problem = lastingProblem;
		if (problem != null && problemAt.plus(REMEMBERED).isAfter(Instant.now())) {
			return new RecipeAiStatus(false, problem.message(), null);
		}
		return new RecipeAiStatus(true, null, null);
	}

	/** What Claude answered, as an error for the back-office; a refused key or an empty account is remembered. */
	ErrorCode failed(Claude.Failure failure) {
		ErrorCode code = switch (failure) {
			case KEY_REFUSED -> ErrorCode.CLAUDE_KEY_REFUSED;
			case NO_CREDIT -> ErrorCode.CLAUDE_NO_CREDIT;
			case RATE_LIMITED -> ErrorCode.CLAUDE_RATE_LIMITED;
			case UNAVAILABLE -> ErrorCode.CLAUDE_UNAVAILABLE;
			case REFUSED -> ErrorCode.CLAUDE_REFUSED;
			case BAD_RESPONSE -> ErrorCode.CLAUDE_BAD_RESPONSE;
		};
		if (failure == Claude.Failure.KEY_REFUSED || failure == Claude.Failure.NO_CREDIT) {
			lastingProblem = code;
			problemAt = Instant.now();
		}
		return code;
	}

}
