package fr.lescreationsdeyona.tag;

import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Tags")
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
class TagController {

	private final TagService tagService;

	@Operation(summary = "All tags, sorted by name, with their number of published recipes")
	@GetMapping
	List<TagSummary> listTags() {
		return tagService.listPublic();
	}

}
