package fr.lescreationsdeyona.accounting;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the API answers about the accounts. */
public final class AccountingResponses {

	private AccountingResponses() {
	}

	/** A year of the accounts. */
	public record AccountingOverview(int year,
			@Schema(description = "The years having lines, and this one") List<Integer> years,
			@Schema(description = "Those a line can be counted for") List<String> admins,
			AccountTotals totals,
			@Schema(description = "Each month having lines, in order") List<MonthTotals> months,
			@Schema(description = "Each admin having lines") List<AdminTotals> byAdmin,
			@Schema(description = "The latest first") List<AccountEntryResponse> entries) {
	}

	public record AccountTotals(BigDecimal income, BigDecimal expense, BigDecimal balance) {
	}

	public record MonthTotals(@Schema(description = "From 1 to 12") int month, AccountTotals totals) {
	}

	public record AdminTotals(String adminEmail, AccountTotals totals) {
	}

	public record AccountEntryResponse(Long id, AccountKind kind, AccountCategory category, LocalDate occurredOn, String label,
			BigDecimal amount, String adminEmail,
			@Schema(description = "The order it comes from: its amount then changes from the order") @Nullable Long orderId) {
	}

}
