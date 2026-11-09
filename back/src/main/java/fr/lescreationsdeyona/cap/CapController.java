package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.cap.CapResponses.CapEntryResponse;
import fr.lescreationsdeyona.cap.CapResponses.ObservationResponse;
import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Mon CAP")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
class CapController {

	private final CapService capService;

	@Operation(summary = "\"Mon CAP\": the published steps, the latest first")
	@GetMapping("/cap/entries")
	List<CapEntryResponse> listCapEntries() {
		return capService.publishedEntries();
	}

	@Operation(summary = "\"Mes observations\": the published ones, the latest first")
	@GetMapping("/cap/observations")
	PageResponse<ObservationResponse> listObservations(@ParameterObject @PageableDefault(size = 20) Pageable pageable) {
		return PageResponse.of(capService.publishedObservations(pageable));
	}

	@Operation(summary = "The published observations about a published recipe, the latest first")
	@GetMapping("/recipes/{slug}/observations")
	List<ObservationResponse> listRecipeObservations(@PathVariable @Size(max = 200) String slug) {
		return capService.observationsOfRecipe(slug);
	}

}
