package fr.lescreationsdeyona.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AdminProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AccountingServiceTest {

	private final AccountEntryRepository repository = mock(AccountEntryRepository.class);

	private final AccountingService service = new AccountingService(repository,
			new AdminProperties(Set.of("yona@example.fr", "max@example.fr")), mock(AuditLog.class));

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
		assertThat(overview.months()).extracting(AccountingResponses.MonthTotals::month).containsExactly(1, 3);
		assertThat(overview.months().get(1).totals().balance()).isEqualByComparingTo("69.50");
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

}
