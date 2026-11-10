package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.cap.CapResponses.CapArticle;
import fr.lescreationsdeyona.cap.CapResponses.CapArticleCard;
import fr.lescreationsdeyona.cap.CapResponses.CapHighlight;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Mon CAP")
@RestController
@RequestMapping("/api/cap")
@RequiredArgsConstructor
class CapController {

	private final CapService capService;

	@Operation(summary = "\"Mon CAP\": the published articles, the latest first, without their blocks")
	@GetMapping("/entries")
	List<CapArticleCard> listCapEntries() {
		return capService.publishedEntries();
	}

	@Operation(summary = "A published article, with its blocks")
	@GetMapping("/entries/{slug}")
	CapArticle getCapEntry(@PathVariable @Size(max = 200) String slug) {
		return capService.publishedEntry(slug);
	}

	@Operation(summary = "The article put forward on the home page: the one chosen, otherwise the latest")
	@ApiResponse(responseCode = "204", description = "No article published yet")
	@GetMapping("/highlight")
	ResponseEntity<CapHighlight> getCapHighlight() {
		CapHighlight highlight = capService.highlight();
		return highlight == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(highlight);
	}

}
