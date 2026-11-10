package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceDetail;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceLineResponse;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSettings;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSettingsForm;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSummary;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * The invoices of the orders handed over: numbered without gap within their year, written once with
 * everything they show (seller, customer, lines), never changed nor deleted. A discount or an extra
 * agreed on the order shows as the difference between its lines and its amount.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvoiceService {

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private final InvoiceRepository invoiceRepository;

	private final ShopOrderRepository orderRepository;

	private final ShopSettingsRepository settingsRepository;

	private final AuditorAware<String> auditor;

	private final AuditLog auditLog;

	private final Clock clock;

	/** "2026-0007": the year, then the rank in it on 4 digits at least. */
	static String number(int year, int rank) {
		return "%d-%04d".formatted(year, rank);
	}

	@Transactional
	public InvoiceDetail issue(long orderId) {
		ShopOrder order = orderRepository.findById(orderId).orElseThrow(() -> new ApiException(ErrorCode.SHOP_ORDER_NOT_FOUND));
		if (order.getStatus() != OrderStatus.PICKED_UP) {
			throw new ApiException(ErrorCode.INVOICE_ORDER_NOT_HANDED_OVER);
		}
		if (order.getAmount().signum() <= 0) {
			throw new ApiException(ErrorCode.INVOICE_ORDER_OFFERED);
		}
		// Locked until committed: two invoices issued at once take the next numbers one after the other
		ShopSettings settings = settingsRepository.findForUpdate(ShopSettings.ID).orElseThrow();
		if (invoiceRepository.existsByOrderId(orderId)) {
			throw new ApiException(ErrorCode.INVOICE_ALREADY_ISSUED);
		}
		if (!StringUtils.hasText(settings.getSellerName()) || !StringUtils.hasText(settings.getSellerAddress())) {
			throw new ApiException(ErrorCode.INVOICE_SELLER_MISSING);
		}
		LocalDate today = LocalDate.now(clock.withZone(PARIS));
		String year = String.valueOf(today.getYear());
		Invoice invoice = new Invoice();
		invoice.setNumber(number(today.getYear(), invoiceRepository.findLastRank(year) + 1));
		invoice.setOrderId(order.getId());
		invoice.setIssuedOn(today);
		invoice.setCustomerName(order.getCustomerName());
		invoice.setCustomerEmail(order.getCustomerEmail());
		invoice.setCustomerPhone(order.getCustomerPhone());
		invoice.setSellerName(settings.getSellerName());
		invoice.setSellerAddress(settings.getSellerAddress());
		invoice.setSellerSiret(settings.getSellerSiret());
		invoice.setSellerContact(settings.getSellerContact());
		invoice.setVatMention(settings.getVatMention());
		invoice.setAmount(order.getAmount());
		invoice.setAdminEmail(auditor.getCurrentAuditor().orElse(""));
		invoice.setCreatedAt(Instant.now(clock));
		if (order.getLines().isEmpty()) {
			// Everything was asked in the message
			invoice.getLines().add(new InvoiceLine("Commande n° " + order.getId(), "Selon votre demande", 1, order.getAmount()));
		}
		else {
			order.getLines()
				.forEach(line -> invoice.getLines().add(new InvoiceLine(line.title(), line.portionLabel(), line.quantity(), line.unitPrice())));
		}
		Invoice saved = invoiceRepository.saveAndFlush(invoice);
		auditLog.record(AuditAction.CREATED, AuditKind.INVOICE, "Facture n° " + saved.getNumber(), saved.getId());
		return toDetail(saved);
	}

	public InvoiceDetail get(long id) {
		return toDetail(invoiceRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.INVOICE_NOT_FOUND)));
	}

	/** The invoices of a year, the latest first. */
	public List<InvoiceSummary> list(int year) {
		return invoiceRepository.findByIssuedOnBetweenOrderByIssuedOnDescIdDesc(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
			.stream()
			.map(InvoiceService::toSummary)
			.toList();
	}

	public InvoiceSettings settings() {
		ShopSettings settings = settingsRepository.findById(ShopSettings.ID).orElseThrow();
		return new InvoiceSettings(settings.getSellerName(), settings.getSellerAddress(), settings.getSellerSiret(),
				settings.getSellerContact(), settings.getVatMention());
	}

	/** For the invoices issued from now on; those already issued keep what they say. */
	@Transactional
	public InvoiceSettings updateSettings(InvoiceSettingsForm form) {
		String siret = blankToNull(form.sellerSiret() == null ? null : form.sellerSiret().replace(" ", ""));
		if (siret != null && !siret.matches("[0-9]{14}")) {
			throw new ApiException(ErrorCode.INVOICE_SIRET_INVALID);
		}
		ShopSettings settings = settingsRepository.findById(ShopSettings.ID).orElseThrow();
		AuditChanges changes = new AuditChanges().add("Nom", settings.getSellerName(), form.sellerName())
			.add("Adresse", settings.getSellerAddress(), form.sellerAddress())
			.add("SIRET", settings.getSellerSiret(), siret)
			.add("Contact", settings.getSellerContact(), form.sellerContact())
			.add("Mention de TVA", settings.getVatMention(), form.vatMention());
		settings.setSellerName(form.sellerName().strip());
		settings.setSellerAddress(form.sellerAddress().strip());
		settings.setSellerSiret(siret);
		settings.setSellerContact(blankToNull(form.sellerContact()));
		settings.setVatMention(form.vatMention().strip());
		settingsRepository.saveAndFlush(settings);
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_SETTINGS, "Informations de facturation", null, changes);
		return settings();
	}

	private static @Nullable String blankToNull(@Nullable String text) {
		return StringUtils.hasText(text) ? text.strip() : null;
	}

	private static InvoiceSummary toSummary(Invoice invoice) {
		return new InvoiceSummary(invoice.getId(), invoice.getNumber(), invoice.getOrderId(), invoice.getIssuedOn(),
				invoice.getCustomerName(), invoice.getAmount());
	}

	static InvoiceDetail toDetail(Invoice invoice) {
		BigDecimal linesTotal = invoice.linesTotal();
		return new InvoiceDetail(invoice.getId(), invoice.getNumber(), invoice.getOrderId(), invoice.getIssuedOn(),
				invoice.getCustomerName(), invoice.getCustomerEmail(), invoice.getCustomerPhone(), invoice.getSellerName(),
				invoice.getSellerAddress(), invoice.getSellerSiret(), invoice.getSellerContact(), invoice.getVatMention(),
				invoice.getLines().stream()
					.map(line -> new InvoiceLineResponse(line.label(), line.detail(), line.quantity(), line.unitPrice(), line.total()))
					.toList(),
				linesTotal, invoice.getAmount(), invoice.getAdminEmail());
	}

}
