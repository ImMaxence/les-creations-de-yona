package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Mon CAP AI")
@RestController
@RequestMapping("/api/admin/cap-ai")
class AdminCapAiController {

	private final CapAiService capAiService;

	AdminCapAiController(CapAiService capAiService) {
		this.capAiService = capAiService;
	}

	@Operation(summary = "Whether \"Écrire avec l'IA\" can use Gemini now (uses none of its quota)")
	@GetMapping
	RecipeAiStatus getCapAiStatus() {
		return capAiService.status();
	}

	@Operation(summary = "Write an article of \"Mon CAP\" from notes with Gemini or Claude, to fill the editor; nothing is saved",
			description = "Typed notes (20,000 characters at most), the photo of handwritten ones (JPEG or PNG, 10 MB max), "
					+ "or both. Takes a few seconds, sometimes half a minute; one at a time.")
	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	CapAiDraft writeCapArticleWithAi(@ModelAttribute CapAiRequest request) {
		return capAiService.draft(request.text(), request.image(), request.form(),
				request.engine() == null ? AiEngine.GEMINI : request.engine());
	}

	@Operation(summary = "What the model running in the browser is told to write an article from these notes")
	@PostMapping("/local-prompt")
	CapAiLocalPrompt getCapAiLocalPrompt(@Valid @RequestBody CapAiLocalRequest request) {
		return capAiService.localPrompt(request.text(), request.form());
	}

	@Operation(summary = "Check the article written by the model running in the browser, to fill the editor; nothing is saved")
	@PostMapping("/local-draft")
	CapAiDraft readCapAiLocalAnswer(@Valid @RequestBody RecipeAiLocalAnswer answer) {
		return capAiService.localDraft(answer.answer());
	}

}
