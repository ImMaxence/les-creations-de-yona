package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceDetail;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSettings;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSettingsForm;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Invoices")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
class AdminInvoiceController {

	private final InvoiceService invoiceService;

	@Operation(summary = "Issue the invoice of an order handed over; numbered without gap in its year, never changed after")
	@PostMapping("/shop/orders/{orderId}/invoice")
	@ResponseStatus(HttpStatus.CREATED)
	InvoiceDetail issueInvoice(@PathVariable long orderId) {
		return invoiceService.issue(orderId);
	}

	@Operation(summary = "The invoices of a year, the latest first")
	@GetMapping("/invoices")
	List<InvoiceSummary> listInvoices(@RequestParam @Min(2000) @Max(2100) int year) {
		return invoiceService.list(year);
	}

	@Operation(summary = "An invoice, as printed")
	@GetMapping("/invoices/{id}")
	InvoiceDetail getInvoice(@PathVariable long id) {
		return invoiceService.get(id);
	}

	@Operation(summary = "Who the invoices are from")
	@GetMapping("/invoices/settings")
	InvoiceSettings getInvoiceSettings() {
		return invoiceService.settings();
	}

	@Operation(summary = "Change who the invoices are from, for those issued from now on")
	@PutMapping("/invoices/settings")
	InvoiceSettings updateInvoiceSettings(@Valid @RequestBody InvoiceSettingsForm form) {
		return invoiceService.updateSettings(form);
	}

}
