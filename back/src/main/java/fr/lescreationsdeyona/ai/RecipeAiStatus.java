package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Whether "Remplir avec l'IA" can be used now, and why not. */
public record RecipeAiStatus(boolean available,
		@Schema(description = "Why not, in French: no key, key refused, daily quota used") @Nullable String reason,
		@Schema(description = "Daily quota used: when it starts again") @Nullable Instant availableAgainAt) {
}
