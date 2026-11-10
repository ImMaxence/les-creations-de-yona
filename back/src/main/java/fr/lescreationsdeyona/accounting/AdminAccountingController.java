package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import fr.lescreationsdeyona.accounting.AccountingResponses.LastPrice;
import fr.lescreationsdeyona.accounting.AccountingResponses.ProductCost;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.image.ImageStorage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Accounting")
@RestController
@RequestMapping("/api/admin/accounting")
@RequiredArgsConstructor
class AdminAccountingController {

	private static final String WEBP = "image/webp";

	private final AccountingService accountingService;

	private final CostPriceService costPriceService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "A month, a quarter or a year of the accounts: its lines, key figures, totals, best sales")
	@GetMapping
	AccountingOverview getAccounting(@RequestParam @Min(2000) @Max(2100) int year,
			@RequestParam(defaultValue = "YEAR") AccountPeriod period,
			@RequestParam(defaultValue = "1") @Min(1) @Max(12) int number) {
		return accountingService.overview(year, period, number);
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

	@Operation(summary = "The last price paid for each ingredient and packaging, from the detailed purchases")
	@GetMapping("/last-prices")
	List<LastPrice> listLastPrices() {
		return costPriceService.lastPrices();
	}

	@Operation(summary = "The cost price of each product of the shop: its recipe at the last prices paid, and its packaging")
	@GetMapping("/costs")
	List<ProductCost> listProductCosts() {
		return costPriceService.productCosts();
	}

	@Operation(summary = "Add a line by hand: an expense (detailed or not), or money that comes from elsewhere than the orders")
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

	@Operation(summary = "Delete a line for good, with its receipt; refused for a line coming from an order")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAccountEntry(@PathVariable long id) {
		accountingService.delete(id);
	}

	@Operation(summary = "Attach the photo of the receipt of an expense (JPEG or PNG), in place of the one before")
	@PutMapping(path = "/{id}/receipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	AccountEntryResponse attachReceipt(@PathVariable long id, @RequestPart("file") MultipartFile file) {
		return accountingService.attachReceipt(id, imageProcessor.processReceipt(file));
	}

	@Operation(summary = "Take the photo of the receipt off an expense, for good")
	@DeleteMapping("/{id}/receipt")
	AccountEntryResponse removeReceipt(@PathVariable long id) {
		return accountingService.removeReceipt(id);
	}

	@Operation(summary = "The photo of the receipt of an expense, 1600 px wide at most", description = "Shown to the admins only.",
			responses = @ApiResponse(responseCode = "200",
					content = @Content(mediaType = WEBP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/{id}/receipt")
	ResponseEntity<InputStreamResource> getReceipt(@PathVariable long id) {
		ImageStorage.StoredFile file = accountingService.openReceipt(id);
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.contentType(MediaType.parseMediaType(WEBP))
			.contentLength(file.size())
			.body(new InputStreamResource(file.content()));
	}

}
