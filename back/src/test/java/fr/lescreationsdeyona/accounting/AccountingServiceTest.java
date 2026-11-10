package fr.lescreationsdeyona.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.accounting.AccountEntryForm.PurchaseLineForm;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import fr.lescreationsdeyona.accounting.AccountingResponses.BestSeller;
import fr.lescreationsdeyona.accounting.AccountingResponses.CategoryTotal;
import fr.lescreationsdeyona.accounting.AccountingResponses.KeyFigures;
import fr.lescreationsdeyona.accounting.AccountingResponses.ProductCost;
import fr.lescreationsdeyona.accounting.AccountingResponses.PurchaseLineResponse;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.security.AdminProperties;
import fr.lescreationsdeyona.shop.OrderStatus;
import fr.lescreationsdeyona.shop.ShopOrder;
import fr.lescreationsdeyona.shop.ShopOrderLine;
import fr.lescreationsdeyona.shop.ShopOrderRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AccountingServiceTest {

	private final AccountEntryRepository repository = mock(AccountEntryRepository.class);

	private final ShopOrderRepository orders = mock(ShopOrderRepository.class);

	private final IngredientRepository ingredients = mock(IngredientRepository.class);

	private final CostPriceService costs = mock(CostPriceService.class);

	private final AccountingService service = new AccountingService(repository,
			new AdminProperties(Set.of("yona@example.fr", "max@example.fr")), mock(AuditLog.class), orders, ingredients, costs,
			mock(ImageService.class));

	@BeforeEach
	void savesAsGiven() {
		when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	private static AccountEntry entry(AccountKind kind, String date, String amount, String admin) {
		AccountEntry entry = new AccountEntry();
		entry.setId(1L);
		entry.setKind(kind);
		entry.setCategory(kind == AccountKind.INCOME ? AccountCategory.SALE : AccountCategory.INGREDIENTS);
		entry.setOccurredOn(LocalDate.parse(date));
		entry.setLabel("Ligne");
		entry.setAmount(new BigDecimal(amount));
		entry.setAdminEmail(admin);
		return entry;
	}

	private void hasLines(AccountEntry... entries) {
		when(repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(any(), any())).thenReturn(List.of(entries));
	}

	private static AccountEntryForm form(AccountKind kind, AccountCategory category, String amount, String admin) {
		return new AccountEntryForm(kind, category, LocalDate.parse("2026-03-01"), " Farine ", new BigDecimal(amount), admin);
	}

	private AccountEntry fromOrder() {
		AccountEntry entry = entry(AccountKind.INCOME, "2026-03-01", "30.00", "max@example.fr");
		entry.setOrderId(12L);
		when(repository.findById(1L)).thenReturn(Optional.of(entry));
		return entry;
	}

	@Test
	void totalsTheYearByMonthAndByAdmin() {
		hasLines(entry(AccountKind.INCOME, "2026-03-10", "100.00", "yona@example.fr"),
				entry(AccountKind.EXPENSE, "2026-03-02", "30.50", "yona@example.fr"),
				entry(AccountKind.INCOME, "2026-01-05", "20.00", "max@example.fr"));

		AccountingOverview overview = service.overview(2026);

		assertThat(overview.totals().income()).isEqualByComparingTo("120");
		assertThat(overview.totals().expense()).isEqualByComparingTo("30.50");
		assertThat(overview.totals().balance()).isEqualByComparingTo("89.50");
		assertThat(overview.months()).extracting(AccountingResponses.MonthTotals::month).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
		assertThat(overview.months().get(1).totals().balance()).isEqualByComparingTo("0");
		assertThat(overview.months().get(2).totals().balance()).isEqualByComparingTo("69.50");
		assertThat(overview.byAdmin()).extracting(AccountingResponses.AdminTotals::adminEmail)
			.containsExactly("max@example.fr", "yona@example.fr");
		assertThat(overview.byAdmin().get(1).totals().balance()).isEqualByComparingTo("69.50");
	}

	@Test
	void listsTheAdminsAndTheOnesWhoLeft() {
		hasLines(entry(AccountKind.INCOME, "2026-03-10", "100.00", "parti@example.fr"));

		assertThat(service.overview(2026).admins()).containsExactly("max@example.fr", "parti@example.fr", "yona@example.fr");
	}

	@Test
	void writesASpreadsheetFrenchExcelReads() {
		AccountEntry sale = entry(AccountKind.INCOME, "2026-03-10", "24.50", "yona@example.fr");
		sale.setOrderId(12L);
		sale.setLabel("Commande n° 12");
		hasLines(sale);

		assertThat(service.csv(2026)).isEqualTo("﻿Date;Type;Catégorie;Libellé;Montant;Admin;Commande\r\n"
				+ "10/03/2026;Entrée;Vente;Commande n° 12;24,50;yona@example.fr;12\r\n");
	}

	@Test
	void writesFormulasAsText() {
		assertThat(AccountingService.csvText("=1+1")).isEqualTo("'=1+1");
		assertThat(AccountingService.csvText("-5 €")).isEqualTo("'-5 €");
		assertThat(AccountingService.csvText("Farine; sucre")).isEqualTo("\"Farine; sucre\"");
	}

	@Test
	void savesALineTypedByHand() {
		assertThat(service.create(form(AccountKind.EXPENSE, AccountCategory.INGREDIENTS, "12.30", "max@example.fr")).label()).isEqualTo("Farine");
	}

	@Test
	void refusesASaleThatIsAnExpense() {
		assertThatThrownBy(() -> service.create(form(AccountKind.EXPENSE, AccountCategory.SALE, "12.30", "max@example.fr")))
			.extracting("code")
			.isEqualTo(ErrorCode.ACCOUNT_CATEGORY_INVALID);
	}

	@Test
	void countsALineForAnAdminOnly() {
		assertThatThrownBy(() -> service.create(form(AccountKind.EXPENSE, AccountCategory.OTHER, "12.30", "autre@example.fr")))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_ADMIN_UNKNOWN);
	}

	@Test
	void letsTheLabelAndTheAdminOfALineFromAnOrderChange() {
		AccountEntry entry = fromOrder();

		service.update(1, form(AccountKind.INCOME, AccountCategory.SALE, "30", "yona@example.fr"));

		assertThat(entry.getAdminEmail()).isEqualTo("yona@example.fr");
		assertThat(entry.getLabel()).isEqualTo("Farine");
	}

	@Test
	void keepsTheAmountOfALineFromAnOrder() {
		fromOrder();

		assertThatThrownBy(() -> service.update(1, form(AccountKind.INCOME, AccountCategory.SALE, "31", "yona@example.fr")))
			.extracting("code")
			.isEqualTo(ErrorCode.ACCOUNT_ENTRY_FROM_ORDER);
	}

	@Test
	void keepsALineFromAnOrder() {
		fromOrder();

		assertThatThrownBy(() -> service.delete(1)).extracting("code").isEqualTo(ErrorCode.ACCOUNT_ENTRY_FROM_ORDER);
		verify(repository, never()).delete(any());
	}

	@Test
	void writesTheSaleOfAnOrderHandedOver() {
		when(repository.findByOrderId(12L)).thenReturn(Optional.empty());

		service.recordSale(12L, new BigDecimal("28.00"), "max@example.fr");

		ArgumentCaptor<AccountEntry> saved = ArgumentCaptor.forClass(AccountEntry.class);
		verify(repository).save(saved.capture());
		assertThat(saved.getValue().getKind()).isEqualTo(AccountKind.INCOME);
		assertThat(saved.getValue().getCategory()).isEqualTo(AccountCategory.SALE);
		assertThat(saved.getValue().getLabel()).isEqualTo("Commande n° 12");
		assertThat(saved.getValue().getOrderId()).isEqualTo(12L);
		assertThat(saved.getValue().getAdminEmail()).isEqualTo("max@example.fr");
	}

	@Test
	void updatesTheSaleOfAnOrderSavedAgain() {
		AccountEntry entry = entry(AccountKind.INCOME, "2026-03-01", "30.00", "max@example.fr");
		when(repository.findByOrderId(12L)).thenReturn(Optional.of(entry));

		service.recordSale(12L, new BigDecimal("28.00"), "yona@example.fr");

		assertThat(entry.getAmount()).isEqualByComparingTo("28");
		assertThat(entry.getAdminEmail()).isEqualTo("yona@example.fr");
		assertThat(entry.getOccurredOn()).isEqualTo(LocalDate.parse("2026-03-01"));
	}

	@Test
	void writesNoSaleForAnOrderOffered() {
		AccountEntry entry = entry(AccountKind.INCOME, "2026-03-01", "30.00", "max@example.fr");
		when(repository.findByOrderId(12L)).thenReturn(Optional.of(entry));

		service.recordSale(12L, BigDecimal.ZERO, "max@example.fr");

		verify(repository).delete(entry);
		verify(repository, never()).save(any());
	}

	@Test
	void showsAQuarterWithTheSameQuarterOfTheYearBefore() {
		when(repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31")))
			.thenReturn(List.of(entry(AccountKind.INCOME, "2026-05-10", "100.00", "yona@example.fr"),
					entry(AccountKind.INCOME, "2026-02-10", "40.00", "yona@example.fr")));
		when(repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(LocalDate.parse("2025-04-01"), LocalDate.parse("2025-06-30")))
			.thenReturn(List.of(entry(AccountKind.INCOME, "2025-05-01", "80.00", "yona@example.fr")));

		AccountingOverview overview = service.overview(2026, AccountPeriod.QUARTER, 2);

		assertThat(overview.from()).isEqualTo(LocalDate.parse("2026-04-01"));
		assertThat(overview.to()).isEqualTo(LocalDate.parse("2026-06-30"));
		assertThat(overview.totals().income()).isEqualByComparingTo("100");
		assertThat(overview.previousTotals().income()).isEqualByComparingTo("80");
		assertThat(overview.entries()).hasSize(1);
		// The chart keeps the whole year
		assertThat(overview.months().get(1).totals().income()).isEqualByComparingTo("40");
	}

	@Test
	void countsTheOrdersAndTheMargin() {
		AccountEntry sale = entry(AccountKind.INCOME, "2026-03-10", "30.00", "yona@example.fr");
		sale.setOrderId(12L);
		AccountEntry other = entry(AccountKind.INCOME, "2026-03-11", "20.00", "yona@example.fr");
		other.setOrderId(13L);
		hasLines(sale, other, entry(AccountKind.EXPENSE, "2026-03-02", "10.00", "yona@example.fr"));
		ShopOrder offered = new ShopOrder();
		offered.setId(14L);
		offered.setAmount(BigDecimal.ZERO);
		offered.setUpdatedAt(Instant.parse("2026-03-20T10:00:00Z"));
		when(orders.findByStatus(OrderStatus.PICKED_UP)).thenReturn(List.of(offered));

		KeyFigures figures = service.overview(2026).figures();

		assertThat(figures.orders()).isEqualTo(3);
		assertThat(figures.offeredOrders()).isEqualTo(1);
		assertThat(figures.averageBasket()).isEqualByComparingTo("25");
		assertThat(figures.marginRate()).isEqualByComparingTo("0.8");
	}

	@Test
	void sharesTheExpensesOutByCategory() {
		AccountEntry packaging = entry(AccountKind.EXPENSE, "2026-03-02", "12.00", "yona@example.fr");
		packaging.setCategory(AccountCategory.PACKAGING);
		hasLines(entry(AccountKind.EXPENSE, "2026-03-02", "30.00", "yona@example.fr"), packaging);

		assertThat(service.overview(2026).expensesByCategory()).extracting(CategoryTotal::category, total -> total.amount().intValue())
			.containsExactly(tuple(AccountCategory.INGREDIENTS, 30), tuple(AccountCategory.PACKAGING, 12),
					tuple(AccountCategory.EQUIPMENT, 0), tuple(AccountCategory.OTHER, 0));
	}

	@Test
	void ranksTheBestSalesWithTheirMargin() {
		AccountEntry sale = entry(AccountKind.INCOME, "2026-03-10", "20.00", "yona@example.fr");
		sale.setOrderId(12L);
		hasLines(sale);
		ShopOrder order = new ShopOrder();
		order.setId(12L);
		order.setAmount(new BigDecimal("20.00"));
		// 24 € listed, 20 € paid: each line brings 5/6 of its price
		order.getLines().add(new ShopOrderLine(1L, 101L, "Boîte de 6 cookies", "Boîte de 6", new BigDecimal("12.00"), 2));
		when(orders.findAllById(List.of(12L))).thenReturn(List.of(order));
		when(costs.costsById()).thenReturn(Map.of(1L, cost(1L, "4.52")));

		AccountingOverview overview = service.overview(2026);

		BestSeller best = overview.bestSellers().getFirst();
		assertThat(best.name()).isEqualTo("Boîte de 6 cookies");
		assertThat(best.quantity()).isEqualTo(2);
		assertThat(best.revenue()).isEqualByComparingTo("20");
		assertThat(best.margin()).isEqualByComparingTo("10.96");
		assertThat(overview.entries().getFirst().orderSummary()).isEqualTo("2 × Boîte de 6 cookies");
		assertThat(overview.entries().getFirst().margin()).isEqualByComparingTo("10.96");
	}

	@Test
	void leavesTheMarginOutWhileACostIsUnknown() {
		AccountEntry sale = entry(AccountKind.INCOME, "2026-03-10", "12.00", "yona@example.fr");
		sale.setOrderId(12L);
		hasLines(sale);
		ShopOrder order = new ShopOrder();
		order.setId(12L);
		order.setAmount(new BigDecimal("12.00"));
		order.getLines().add(new ShopOrderLine(2L, null, "Coffret", "À l'unité", new BigDecimal("12.00"), 1));
		when(orders.findAllById(List.of(12L))).thenReturn(List.of(order));
		when(costs.costsById()).thenReturn(Map.of());

		AccountingOverview overview = service.overview(2026);

		assertThat(overview.bestSellers().getFirst().margin()).isNull();
		assertThat(overview.entries().getFirst().margin()).isNull();
	}

	@Test
	void addsUpADetailedPurchaseUnderTheIngredientsName() {
		Ingredient butter = new Ingredient();
		butter.setId(7L);
		butter.setName("Beurre doux");
		when(ingredients.findAllById(List.of(7L))).thenReturn(List.of(butter));
		AccountEntryForm form = new AccountEntryForm(AccountKind.EXPENSE, AccountCategory.INGREDIENTS, LocalDate.parse("2026-03-01"),
				"Courses du marché", new BigDecimal("1.00"), "yona@example.fr",
				List.of(new PurchaseLineForm(7L, "beurre", new BigDecimal("1"), PurchaseUnit.KG, new BigDecimal("9.80")),
						new PurchaseLineForm(null, "Œufs", new BigDecimal("6"), PurchaseUnit.PIECE, new BigDecimal("1.80"))));

		AccountEntryResponse saved = service.create(form);

		assertThat(saved.amount()).isEqualByComparingTo("11.60");
		assertThat(saved.purchases()).extracting(PurchaseLineResponse::item).containsExactly("Beurre doux", "Œufs");
		assertThat(saved.purchases().get(0).pricePerUnit()).isEqualByComparingTo("9.80");
		assertThat(saved.purchases().get(0).priceUnit()).isEqualTo(PriceUnit.KG);
		assertThat(saved.purchases().get(1).pricePerUnit()).isEqualByComparingTo("0.30");
		assertThat(saved.purchases().get(1).priceUnit()).isEqualTo(PriceUnit.PIECE);
	}

	@Test
	void detailsTheExpensesForIngredientsOrPackagingOnly() {
		AccountEntryForm form = new AccountEntryForm(AccountKind.EXPENSE, AccountCategory.EQUIPMENT, LocalDate.parse("2026-03-01"),
				"Moule", new BigDecimal("15.00"), "yona@example.fr",
				List.of(new PurchaseLineForm(null, "Moule", BigDecimal.ONE, PurchaseUnit.PIECE, new BigDecimal("15.00"))));

		assertThatThrownBy(() -> service.create(form)).extracting("code").isEqualTo(ErrorCode.ACCOUNT_PURCHASE_INVALID);
	}

	private static ProductCost cost(long productId, String cost) {
		return new ProductCost(productId, "Produit", null, new BigDecimal("12.00"), 6, BigDecimal.ONE, List.of(), null,
				new BigDecimal(cost), true, new BigDecimal("12.00").subtract(new BigDecimal(cost)), null);
	}

}
