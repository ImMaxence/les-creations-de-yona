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

	/** A month, a quarter or a year of the accounts. */
	public record AccountingOverview(int year, AccountPeriod period,
			@Schema(description = "The month (1 to 12) or the quarter (1 to 4); 1 for a year") int number, LocalDate from,
			LocalDate to, @Schema(description = "The years having lines, and this one") List<Integer> years,
			@Schema(description = "Those a line can be counted for") List<String> admins, AccountTotals totals,
			@Schema(description = "The same period a year before") AccountTotals previousTotals, KeyFigures figures,
			@Schema(description = "The 12 months of the year, for the chart") List<MonthTotals> months,
			@Schema(description = "Each admin having lines") List<AdminTotals> byAdmin,
			@Schema(description = "The expenses by category, those of ingredients first") List<CategoryTotal> expensesByCategory,
			@Schema(description = "The products sold, the best first: paid orders only") List<BestSeller> bestSellers,
			@Schema(description = "The latest first") List<AccountEntryResponse> entries) {
	}

	public record AccountTotals(BigDecimal income, BigDecimal expense, BigDecimal balance) {
	}

	public record KeyFigures(@Schema(description = "Handed over in the period, offered ones included") int orders,
			@Schema(description = "Handed over for nothing") int offeredOrders,
			@Schema(description = "What a paid order brings, on average") @Nullable BigDecimal averageBasket,
			@Schema(description = "The balance over the income, from 0 to 1; absent without income") @Nullable BigDecimal marginRate) {
	}

	public record MonthTotals(@Schema(description = "From 1 to 12") int month, AccountTotals totals) {
	}

	public record AdminTotals(String adminEmail, AccountTotals totals) {
	}

	public record CategoryTotal(AccountCategory category, BigDecimal amount) {
	}

	public record BestSeller(@Nullable Long productId, String name, int quantity,
			@Schema(description = "What it brought, the discounts of its orders shared out") BigDecimal revenue,
			@Schema(description = "Its revenue less its cost price; absent while its cost is unknown") @Nullable BigDecimal margin) {
	}

	public record AccountEntryResponse(Long id, AccountKind kind, AccountCategory category, LocalDate occurredOn, String label,
			BigDecimal amount, String adminEmail,
			@Schema(description = "The order it comes from: its amount then changes from the order") @Nullable Long orderId,
			@Schema(description = "What an expense was made of; empty when not detailed") List<PurchaseLineResponse> purchases,
			@Schema(description = "A photo of the receipt is attached") boolean receipt,
			@Schema(description = "What the order held: \"2 × Boîte de 6 cookies\"; absent once the order is erased") @Nullable String orderSummary,
			@Schema(description = "The amount of the order less the cost price of what it held; absent when unknown") @Nullable BigDecimal margin) {
	}

	public record PurchaseLineResponse(String item, @Nullable Long ingredientId, BigDecimal quantity, PurchaseUnit unit,
			BigDecimal price, @Schema(description = "Per kilo, per litre or per piece") BigDecimal pricePerUnit, PriceUnit priceUnit) {
	}

	/** The last price paid for an ingredient or a packaging, kept by the site. */
	public record LastPrice(String item, @Nullable Long ingredientId, BigDecimal pricePerUnit, PriceUnit priceUnit,
			LocalDate paidOn) {
	}

	/** What a product costs to make: its recipe at the last prices paid, and its packaging. */
	public record ProductCost(Long productId, String name, @Nullable String recipeTitle,
			@Schema(description = "Its sale price, including taxes") BigDecimal price, @Nullable Integer batchSize,
			@Schema(description = "Share of its recipe in one product") BigDecimal recipeShare, List<CostLine> lines,
			@Nullable CostLine packaging, @Schema(description = "The known costs added up") BigDecimal cost,
			@Schema(description = "Every line has its price") boolean complete, BigDecimal margin,
			@Schema(description = "The margin over the price, from 0 to 1; absent for a free product") @Nullable BigDecimal marginRate) {
	}

	/** "Beurre doux, 125 g, 9,80 €/kg: 1,23 €". */
	public record CostLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Schema(description = "The last price paid; absent when never bought, or not comparable") @Nullable BigDecimal pricePerUnit,
			@Nullable PriceUnit priceUnit, @Schema(description = "Absent when unknown") @Nullable BigDecimal cost) {
	}

}
