package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceDetail;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSettingsForm;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.AuditorAware;

class InvoiceServiceTest {

	private final InvoiceRepository invoices = mock(InvoiceRepository.class);

	private final ShopOrderRepository orders = mock(ShopOrderRepository.class);

	private final ShopSettingsRepository settingsRepository = mock(ShopSettingsRepository.class);

	@SuppressWarnings("unchecked")
	private final AuditorAware<String> auditor = mock(AuditorAware.class);

	/** 31 December 2026, 23:30 UTC: already 1 January 2027 in Paris. */
	private final Clock newYearsEve = Clock.fixed(Instant.parse("2026-12-31T23:30:00Z"), ZoneOffset.UTC);

	private final InvoiceService service = new InvoiceService(invoices, orders, settingsRepository, auditor, mock(AuditLog.class),
			newYearsEve);

	private final ShopSettings settings = new ShopSettings();

	private final ShopOrder order = new ShopOrder();

	@BeforeEach
	void setUp() {
		settings.setSellerName("Yona Dupont");
		settings.setSellerAddress("12 rue des Lilas, 75011 Paris");
		settings.setVatMention("TVA non applicable, art. 293 B du CGI");
		when(settingsRepository.findForUpdate(ShopSettings.ID)).thenReturn(Optional.of(settings));
		when(settingsRepository.findById(ShopSettings.ID)).thenReturn(Optional.of(settings));
		when(auditor.getCurrentAuditor()).thenReturn(Optional.of("yona@example.fr"));
		when(invoices.saveAndFlush(any())).thenAnswer(invocation -> {
			Invoice invoice = invocation.getArgument(0);
			invoice.setId(7L);
			return invoice;
		});
		order.setId(12L);
		order.setStatus(OrderStatus.PICKED_UP);
		order.setCustomerName("Camille");
		order.setCustomerEmail("camille@example.fr");
		order.setAmount(new BigDecimal("33.00"));
		order.getLines().add(new ShopOrderLine(1L, 101L, "Boîte de 6 cookies", "Boîte de 6", new BigDecimal("12.00"), 2));
		order.getLines().add(new ShopOrderLine(2L, null, "Coffret", "À l'unité", new BigDecimal("10.00"), 1));
		when(orders.findById(12L)).thenReturn(Optional.of(order));
	}

	private Invoice saved() {
		ArgumentCaptor<Invoice> saved = ArgumentCaptor.forClass(Invoice.class);
		verify(invoices).saveAndFlush(saved.capture());
		return saved.getValue();
	}

	@Test
	void numbersTheInvoicesOfAYearWithoutGap() {
		when(invoices.findLastRank("2027")).thenReturn(41);

		InvoiceDetail invoice = service.issue(12);

		assertThat(invoice.number()).isEqualTo("2027-0042");
		assertThat(invoice.issuedOn()).isEqualTo(LocalDate.parse("2027-01-01"));
	}

	@Test
	void startsEachYearAtOne() {
		assertThat(service.issue(12).number()).isEqualTo("2027-0001");
		assertThat(InvoiceService.number(2026, 12345)).isEqualTo("2026-12345");
	}

	@Test
	void copiesTheOrderTheSellerAndTheCustomer() {
		service.issue(12);

		Invoice invoice = saved();
		assertThat(invoice.getOrderId()).isEqualTo(12L);
		assertThat(invoice.getCustomerName()).isEqualTo("Camille");
		assertThat(invoice.getCustomerEmail()).isEqualTo("camille@example.fr");
		assertThat(invoice.getSellerName()).isEqualTo("Yona Dupont");
		assertThat(invoice.getSellerAddress()).isEqualTo("12 rue des Lilas, 75011 Paris");
		assertThat(invoice.getVatMention()).isEqualTo("TVA non applicable, art. 293 B du CGI");
		assertThat(invoice.getAdminEmail()).isEqualTo("yona@example.fr");
		assertThat(invoice.getLines()).extracting(InvoiceLine::label).containsExactly("Boîte de 6 cookies", "Coffret");
		assertThat(invoice.getLines().getFirst().total()).isEqualByComparingTo("24.00");
	}

	@Test
	void showsADiscountAsTheDifferenceWithTheLines() {
		InvoiceDetail invoice = service.issue(12);

		assertThat(invoice.linesTotal()).isEqualByComparingTo("34.00");
		assertThat(invoice.amount()).isEqualByComparingTo("33.00");
	}

	@Test
	void writesOneLineForARequestMadeInTheMessage() {
		order.getLines().clear();

		InvoiceDetail invoice = service.issue(12);

		assertThat(invoice.lines()).hasSize(1);
		assertThat(invoice.lines().getFirst().label()).isEqualTo("Commande n° 12");
		assertThat(invoice.lines().getFirst().total()).isEqualByComparingTo("33.00");
	}

	@Test
	void waitsForTheOrderToBeHandedOver() {
		order.setStatus(OrderStatus.READY);

		assertThatThrownBy(() -> service.issue(12)).extracting("code").isEqualTo(ErrorCode.INVOICE_ORDER_NOT_HANDED_OVER);
		verify(invoices, never()).saveAndFlush(any());
	}

	@Test
	void refusesAnOrderOffered() {
		order.setAmount(BigDecimal.ZERO);

		assertThatThrownBy(() -> service.issue(12)).extracting("code").isEqualTo(ErrorCode.INVOICE_ORDER_OFFERED);
	}

	@Test
	void issuesOneInvoicePerOrder() {
		when(invoices.existsByOrderId(12L)).thenReturn(true);

		assertThatThrownBy(() -> service.issue(12)).extracting("code").isEqualTo(ErrorCode.INVOICE_ALREADY_ISSUED);
	}

	@Test
	void needsTheSellerFirst() {
		settings.setSellerAddress(" ");

		assertThatThrownBy(() -> service.issue(12)).extracting("code").isEqualTo(ErrorCode.INVOICE_SELLER_MISSING);
	}

	@Test
	void refusesAnUnknownOrderOrInvoice() {
		assertThatThrownBy(() -> service.issue(99)).extracting("code").isEqualTo(ErrorCode.SHOP_ORDER_NOT_FOUND);
		assertThatThrownBy(() -> service.get(99)).extracting("code").isEqualTo(ErrorCode.INVOICE_NOT_FOUND);
	}

	@Test
	void listsTheInvoicesOfAYear() {
		Invoice invoice = new Invoice();
		invoice.setId(1L);
		invoice.setNumber("2026-0001");
		invoice.setOrderId(12L);
		invoice.setIssuedOn(LocalDate.parse("2026-03-01"));
		invoice.setCustomerName("Camille");
		invoice.setAmount(new BigDecimal("12.00"));
		when(invoices.findByIssuedOnBetweenOrderByIssuedOnDescIdDesc(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31")))
			.thenReturn(List.of(invoice));

		assertThat(service.list(2026)).extracting(InvoiceResponses.InvoiceSummary::number).containsExactly("2026-0001");
	}

	@Test
	void keepsTheSiretAsDigitsOnly() {
		service.updateSettings(new InvoiceSettingsForm(" Yona ", " 12 rue des Lilas ", "123 456 789 00012", " ", "TVA non applicable"));

		assertThat(settings.getSellerName()).isEqualTo("Yona");
		assertThat(settings.getSellerAddress()).isEqualTo("12 rue des Lilas");
		assertThat(settings.getSellerSiret()).isEqualTo("12345678900012");
		assertThat(settings.getSellerContact()).isNull();
	}

	@Test
	void refusesASiretOfAnotherLength() {
		assertThatThrownBy(() -> service.updateSettings(new InvoiceSettingsForm("Yona", "Paris", "1234", null, "TVA")))
			.extracting("code")
			.isEqualTo(ErrorCode.INVOICE_SIRET_INVALID);
	}

	@Test
	void leavesTheSiretOutUntilRegistered() {
		service.updateSettings(new InvoiceSettingsForm("Yona", "Paris", "", null, "TVA non applicable, art. 293 B du CGI"));

		assertThat(settings.getSellerSiret()).isNull();
		assertThat(service.settings().vatMention()).isEqualTo("TVA non applicable, art. 293 B du CGI");
	}

}
