package fr.lescreationsdeyona.shop;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the API answers and takes about the invoices. */
public final class InvoiceResponses {

	private InvoiceResponses() {
	}

	/** An invoice in a list. */
	public record InvoiceSummary(Long id, String number, Long orderId, LocalDate issuedOn, String customerName, BigDecimal amount) {
	}

	/** An invoice as printed. */
	public record InvoiceDetail(Long id, String number, Long orderId, LocalDate issuedOn, String customerName,
			@Nullable String customerEmail, @Nullable String customerPhone, String sellerName, @Nullable String sellerAddress,
			@Nullable String sellerSiret, @Nullable String sellerContact, String vatMention, List<InvoiceLineResponse> lines,
			@Schema(description = "The lines added up") BigDecimal linesTotal,
			@Schema(description = "What is paid, taxes included; a discount or an extra is the difference with the lines") BigDecimal amount,
			String adminEmail) {
	}

	public record InvoiceLineResponse(String label, @Nullable String detail, int quantity, BigDecimal unitPrice, BigDecimal total) {
	}

	/** Who the invoices are from: copied into each one when it is issued. */
	public record InvoiceSettings(@Nullable String sellerName, @Nullable String sellerAddress, @Nullable String sellerSiret,
			@Nullable String sellerContact, String vatMention) {
	}

	public record InvoiceSettingsForm(
			@Schema(description = "The name on the invoices: \"Yona Dupont, Les créations de Yona\"") @NotBlank @Size(max = 150) String sellerName,
			@Schema(description = "Postal address") @NotBlank @Size(max = 500) String sellerAddress,
			@Schema(description = "14 digits, once registered") @Pattern(regexp = "^$|^[0-9 ]{14,17}$") @Nullable String sellerSiret,
			@Schema(description = "Email or phone") @Size(max = 200) @Nullable String sellerContact,
			@Schema(description = "\"TVA non applicable, art. 293 B du CGI\"") @NotBlank @Size(max = 200) String vatMention) {
	}

}
