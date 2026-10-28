package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Recipe AI")
@RestController
@RequestMapping("/api/admin/recipe-ai")
class AdminRecipeAiController {

	private final RecipeAiService recipeAiService;

	AdminRecipeAiController(RecipeAiService recipeAiService) {
		this.recipeAiService = recipeAiService;
	}

	@Operation(summary = "Whether \"Remplir avec l'IA\" can be used now (uses none of Gemini's quota)")
	@GetMapping
	RecipeAiStatus getRecipeAiStatus() {
		return recipeAiService.status();
	}

	@Operation(summary = "Read a recipe with Gemini, to fill the editor; nothing is saved",
			description = "A pasted text (20,000 characters at most), a photo (JPEG or PNG, 10 MB max), or both. "
					+ "Takes a few seconds, sometimes half a minute; one at a time.")
	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	RecipeAiDraft fillRecipeWithAi(@ModelAttribute RecipeAiRequest request) {
		return recipeAiService.draft(request.text(), request.image());
	}

}
