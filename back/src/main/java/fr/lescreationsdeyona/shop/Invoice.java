package fr.lescreationsdeyona.shop;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/**
 * The invoice of an order handed over. Written once and never changed: everything it shows is copied in
 * it (the order is erased after 12 months, an invoice is kept 10 years). {@code orderId}: without foreign
 * key, for that reason.
 */
@Entity
@Getter
@Setter
public class Invoice {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** "2026-0001": the year it is issued, then its rank in that year, without gap. */
	private String number;

	private Long orderId;

	private LocalDate issuedOn;

	private String customerName;

	private String customerEmail;

	private String customerPhone;

	private String sellerName;

	private String sellerAddress;

	private String sellerSiret;

	private String sellerContact;

	private String vatMention;

	/** What the customer pays, all taxes included: the order's amount. */
	private BigDecimal amount;

	/** The admin who issued it. */
	private String adminEmail;

	private Instant createdAt;

	@Setter(AccessLevel.NONE)
	@ElementCollection
	@CollectionTable(name = "invoice_line", joinColumns = @JoinColumn(name = "invoice_id"))
	@OrderColumn(name = "position")
	private List<InvoiceLine> lines = new ArrayList<>();

	/** The lines added up; the amount may differ (a discount, an extra agreed afterwards). */
	public BigDecimal linesTotal() {
		return lines.stream().map(InvoiceLine::total).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

}
