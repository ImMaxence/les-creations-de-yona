package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Claude")
@RestController
class AdminClaudeController {

	/** Whether Claude can be chosen in the windows of the AI, and which model answers. */
	record ClaudeAvailability(boolean available,
			@Schema(description = "Why not, in French: no key, key refused, no credit left") @Nullable String reason,
			@Schema(description = "\"claude-haiku-5-5\"") String model) {
	}

	private final OnlineAi onlineAi;

	AdminClaudeController(OnlineAi onlineAi) {
		this.onlineAi = onlineAi;
	}

	@Operation(summary = "Whether Claude can be chosen in \"Remplir avec l'IA\" and \"Écrire avec l'IA\" (asks nothing to Anthropic)")
	@GetMapping("/api/admin/claude")
	ClaudeAvailability getClaudeAvailability() {
		RecipeAiStatus status = onlineAi.claudeStatus();
		return new ClaudeAvailability(status.available(), status.reason(), onlineAi.claudeModel());
	}

}
