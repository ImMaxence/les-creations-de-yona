package fr.lescreationsdeyona.glossary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Glossary")
@RestController
@RequestMapping("/api/glossary")
@RequiredArgsConstructor
class GlossaryController {

	private final GlossaryService glossaryService;

	@Operation(summary = "Every word of the glossary, sorted by name")
	@GetMapping
	List<GlossaryTermResponse> listGlossary() {
		return glossaryService.list();
	}

}
