package fr.lescreationsdeyona.stats;

import fr.lescreationsdeyona.security.Admins;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Stats")
@RestController
@RequiredArgsConstructor
class AiVisitController {

	private final AiVisitService aiVisitService;

	@Operation(summary = "A visit coming from an AI assistant, sent once per visit by the browser",
			description = "Counts one visit for that assistant and day; nothing about the visitor is kept. The admins' own "
					+ "visits are not counted. No CSRF token: visitors have none.")
	@PostMapping("/api/ai-visits/{assistant}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void recordAiVisit(@PathVariable AiAssistant assistant, @Nullable Authentication authentication) {
		if (!Admins.isAdmin(authentication)) {
			aiVisitService.record(assistant);
		}
	}

}
