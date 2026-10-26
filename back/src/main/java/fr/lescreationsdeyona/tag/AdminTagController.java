package fr.lescreationsdeyona.tag;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// Fully qualified: this package has its own Tag (the entity).
@io.swagger.v3.oas.annotations.tags.Tag(name = "Admin - Tags")
@RestController
@RequestMapping("/api/admin/tags")
@RequiredArgsConstructor
class AdminTagController {

	private final TagService tagService;

	@Operation(summary = "All tags, sorted by name, with their number of recipes (drafts included)")
	@GetMapping
	List<TagSummary> listAdminTags() {
		return tagService.listAll();
	}

	@Operation(summary = "Create a tag")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	TagResponse createTag(@Valid @RequestBody TagForm form) {
		return tagService.create(form);
	}

	@Operation(summary = "Rename a tag (its slug does not change)")
	@PutMapping("/{id}")
	TagResponse renameTag(@PathVariable long id, @Valid @RequestBody TagForm form) {
		return tagService.rename(id, form);
	}

	@Operation(summary = "Delete tags, all or none; they are taken off their recipes")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteTags(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids) {
		tagService.deleteAll(ids);
	}

}
