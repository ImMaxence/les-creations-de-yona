package fr.lescreationsdeyona.monitoring;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** What came since the admin last looked: the badge of an entry of the back-office menu. */
public record Unseen(long count,
		@Schema(description = "Since when it counts: the last visit, or 7 days ago the first time") Instant since) {

	/** The first time, the last 7 days count as new. */
	public static final java.time.Duration FIRST_TIME = java.time.Duration.ofDays(7);

}
