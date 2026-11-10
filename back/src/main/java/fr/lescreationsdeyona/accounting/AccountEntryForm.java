package fr.lescreationsdeyona.accounting;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** A line typed by hand; on a line coming from an order, only the date, the label and the admin may change. */
public record AccountEntryForm(
		@NotNull AccountKind kind,
		@NotNull AccountCategory category,
		@NotNull LocalDate occurredOn,
		@NotBlank @Size(max = 200) String label,
		@Schema(description = "In euros, always positive; with purchases, their total (computed again by the server)")
		@NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal amount,
		@Schema(description = "Email of the admin it is counted for") @NotBlank @Size(max = 254) String adminEmail,
		@Schema(description = "What an expense for ingredients or packaging was made of; empty or absent when not detailed")
		@Size(max = 60) @Nullable List<@Valid @NotNull PurchaseLineForm> purchases) {

	/** Without purchases. */
	public AccountEntryForm(AccountKind kind, AccountCategory category, LocalDate occurredOn, String label, BigDecimal amount,
			String adminEmail) {
		this(kind, category, occurredOn, label, amount, adminEmail, null);
	}

	/** "Beurre doux, 1 kg, 9,80 €". */
	public record PurchaseLineForm(
			@Schema(description = "An ingredient of the site; absent for packaging") @Nullable Long ingredientId,
			@Schema(description = "Its name: the ingredient's, or the packaging's (\"Boîte kraft\")") @NotBlank @Size(max = 100) String item,
			@NotNull @DecimalMin("0.001") @Digits(integer = 7, fraction = 3) BigDecimal quantity,
			@NotNull PurchaseUnit unit,
			@Schema(description = "Paid for that quantity, in euros") @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal price) {
	}

}
