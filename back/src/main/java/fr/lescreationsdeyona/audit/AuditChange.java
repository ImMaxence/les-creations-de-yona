package fr.lescreationsdeyona.audit;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/**
 * A field changed by an update, with its value before and after, in French as the back-office shows
 * it. For a list (ingredients, steps…), only the lines removed ({@code before}) and added ({@code after}).
 */
public record AuditChange(@Schema(description = "Name of the field, in French") String field,
		@Schema(description = "Absent when it was empty; several lines for a list") @Nullable String before,
		@Schema(description = "Absent when it is now empty; several lines for a list") @Nullable String after) {
}
