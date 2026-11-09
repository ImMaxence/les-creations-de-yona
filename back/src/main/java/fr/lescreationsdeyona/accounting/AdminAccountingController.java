package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

@Tag(name = "Admin - Accounting")
@RestController
@RequestMapping("/api/admin/accounting")
@RequiredArgsConstructor
class AdminAccountingController {

	private final AccountingService accountingService;

	@Operation(summary = "A year of the accounts: its lines, its totals by month and by admin")
	@GetMapping
	AccountingOverview getAccounting(@RequestParam @Min(2000) @Max(2100) int year) {
		return accountingService.overview(year);
	}

	@Operation(summary = "A year of the accounts as a CSV file, for a spreadsheet",
			description = "Opened as a link by the browser, like the backup. Semicolons, decimal commas.")
	@GetMapping("/export")
	ResponseEntity<byte[]> exportAccounting(@RequestParam @Min(2000) @Max(2100) int year) {
		return ResponseEntity.ok()
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename("comptabilite-" + year + ".csv").build().toString())
			.contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
			.body(accountingService.csv(year).getBytes(StandardCharsets.UTF_8));
	}

	@Operation(summary = "Add a line by hand: an expense, or money that comes from elsewhere than the orders")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AccountEntryResponse createAccountEntry(@Valid @RequestBody AccountEntryForm form) {
		return accountingService.create(form);
	}

	@Operation(summary = "Change a line", description = "A line coming from an order keeps its kind, category and amount.")
	@PutMapping("/{id}")
	AccountEntryResponse updateAccountEntry(@PathVariable long id, @Valid @RequestBody AccountEntryForm form) {
		return accountingService.update(id, form);
	}

	@Operation(summary = "Delete a line for good; refused for a line coming from an order")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAccountEntry(@PathVariable long id) {
		accountingService.delete(id);
	}

}
