package fr.lescreationsdeyona.shop;

import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/** A line of an invoice: "Boîte de 6 cookies", its format, how many, at what price each (taxes included). */
@Embeddable
public record InvoiceLine(String label, String detail, int quantity, BigDecimal unitPrice) {

	public BigDecimal total() {
		return unitPrice.multiply(BigDecimal.valueOf(quantity));
	}

}
