package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.cap.CapResponses.CapEntryResponse;
import fr.lescreationsdeyona.cap.CapResponses.ObservationResponse;
import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Mon CAP")
@RestController
@RequestMapping("/api/admin/cap")
@RequiredArgsConstructor
class AdminCapController {

	private final CapService capService;

	@Operation(summary = "Every step of \"Mon CAP\", the latest first")
	@GetMapping("/entries")
	List<CapEntryResponse> listAdminCapEntries() {
		return capService.allEntries();
	}

	@Operation(summary = "Add a step to \"Mon CAP\"")
	@PostMapping("/entries")
	@ResponseStatus(HttpStatus.CREATED)
	CapEntryResponse createCapEntry(@Valid @RequestBody CapEntryForm form) {
		return capService.createEntry(form);
	}

	@Operation(summary = "Change a step of \"Mon CAP\"")
	@PutMapping("/entries/{id}")
	CapEntryResponse updateCapEntry(@PathVariable long id, @Valid @RequestBody CapEntryForm form) {
		return capService.updateEntry(id, form);
	}

	@Operation(summary = "Move a step of \"Mon CAP\" to the trash, kept 30 days")
	@DeleteMapping("/entries/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteCapEntry(@PathVariable long id) {
		capService.deleteEntry(id);
	}

	@Operation(summary = "Every observation, the latest first")
	@GetMapping("/observations")
	PageResponse<ObservationResponse> listAdminObservations(@ParameterObject @PageableDefault(size = 20) Pageable pageable) {
		return PageResponse.of(capService.allObservations(pageable));
	}

	@Operation(summary = "Add an observation, about a recipe or about none")
	@PostMapping("/observations")
	@ResponseStatus(HttpStatus.CREATED)
	ObservationResponse createObservation(@Valid @RequestBody ObservationForm form) {
		return capService.createObservation(form);
	}

	@Operation(summary = "Change an observation")
	@PutMapping("/observations/{id}")
	ObservationResponse updateObservation(@PathVariable long id, @Valid @RequestBody ObservationForm form) {
		return capService.updateObservation(id, form);
	}

	@Operation(summary = "Move an observation to the trash, kept 30 days")
	@DeleteMapping("/observations/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteObservation(@PathVariable long id) {
		capService.deleteObservation(id);
	}

}
