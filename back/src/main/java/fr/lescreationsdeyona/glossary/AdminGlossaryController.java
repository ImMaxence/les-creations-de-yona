package fr.lescreationsdeyona.glossary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Glossary")
@RestController
@RequestMapping("/api/admin/glossary")
@RequiredArgsConstructor
class AdminGlossaryController {

	private final GlossaryService glossaryService;

	@Operation(summary = "Add a word to the glossary")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	GlossaryTermResponse createGlossaryTerm(@Valid @RequestBody GlossaryTermForm form) {
		return glossaryService.create(form);
	}

	@Operation(summary = "Change a word of the glossary (its anchor does not change)")
	@PutMapping("/{id}")
	GlossaryTermResponse updateGlossaryTerm(@PathVariable long id, @Valid @RequestBody GlossaryTermForm form) {
		return glossaryService.update(id, form);
	}

	@Operation(summary = "Delete words of the glossary, all or none")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteGlossaryTerms(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids) {
		glossaryService.deleteAll(ids);
	}

}
