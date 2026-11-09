package fr.lescreationsdeyona.accounting;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** A line typed by hand; on a line coming from an order, only the date, the label and the admin may change. */
public record AccountEntryForm(
		@NotNull AccountKind kind,
		@NotNull AccountCategory category,
		@NotNull LocalDate occurredOn,
		@NotBlank @Size(max = 200) String label,
		@Schema(description = "In euros, always positive") @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal amount,
		@Schema(description = "Email of the admin it is counted for") @NotBlank @Size(max = 254) String adminEmail) {
}
