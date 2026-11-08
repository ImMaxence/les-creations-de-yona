package fr.lescreationsdeyona.feedback;

import io.swagger.v3.oas.annotations.media.Schema;

/** What the browser solves when "Je ne suis pas un robot" is ticked. */
public record FeedbackChallenge(@Schema(description = "Signed, valid 30 minutes, for one message") String token,
		@Schema(description = "Zero bits the SHA-256 of \"token:solution\" must start with") int difficulty) {
}
