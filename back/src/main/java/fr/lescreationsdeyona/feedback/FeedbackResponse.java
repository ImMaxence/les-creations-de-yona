package fr.lescreationsdeyona.feedback;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** A visitor's message, in the back-office. */
public record FeedbackResponse(Long id, Instant createdAt, String message, @Nullable String email, @Nullable String page,
		@Nullable Instant readAt) {
}
