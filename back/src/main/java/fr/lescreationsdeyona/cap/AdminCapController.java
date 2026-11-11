package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.cap.CapResponses.AdminCapEntry;
import fr.lescreationsdeyona.cap.CapResponses.AdminCapEntrySummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Mon CAP")
@RestController
@RequestMapping("/api/admin/cap")
@RequiredArgsConstructor
class AdminCapController {

	private final CapService capService;

	@Operation(summary = "Every article of \"Mon CAP\", the latest first, without their blocks")
	@GetMapping("/entries")
	List<AdminCapEntrySummary> listAdminCapEntries() {
		return capService.allEntries();
	}

	@Operation(summary = "An article of \"Mon CAP\", with every block")
	@GetMapping("/entries/{id}")
	AdminCapEntry getAdminCapEntry(@PathVariable long id) {
		return capService.entry(id);
	}

	@Operation(summary = "Add an article to \"Mon CAP\"; its address is made from its title")
	@PostMapping("/entries")
	@ResponseStatus(HttpStatus.CREATED)
	AdminCapEntry createCapEntry(@Valid @RequestBody CapEntryForm form) {
		return capService.createEntry(form);
	}

	@Operation(summary = "Change an article of \"Mon CAP\"", description = "Its address follows the title while it is a draft.")
	@PutMapping("/entries/{id}")
	AdminCapEntry updateCapEntry(@PathVariable long id, @Valid @RequestBody CapEntryForm form) {
		return capService.updateEntry(id, form);
	}

	@Operation(summary = "Duplicate an article of \"Mon CAP\": a draft titled \"… (copie)\", same date, style, photos and blocks")
	@PostMapping("/entries/{id}/duplicate")
	@ResponseStatus(HttpStatus.CREATED)
	AdminCapEntry duplicateCapEntry(@PathVariable long id) {
		return capService.duplicateEntry(id);
	}

	@Operation(summary = "Move an article of \"Mon CAP\" to the trash, kept 30 days")
	@DeleteMapping("/entries/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteCapEntry(@PathVariable long id) {
		capService.deleteEntry(id);
	}

}
