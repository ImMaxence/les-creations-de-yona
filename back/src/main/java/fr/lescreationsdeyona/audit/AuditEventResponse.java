package fr.lescreationsdeyona.audit;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** A line of the back-office history. */
public record AuditEventResponse(Long id, Instant happenedAt,
		@Schema(description = "The admin's email, or \"site\" for what the site did on its own") String actor,
		AuditAction action, AuditKind kind, @Schema(description = "Its title or name at that time") String label,
		@Schema(description = "To link to it while it exists") @Nullable Long targetId) {
}
