package fr.lescreationsdeyona.accounting;

import java.math.BigDecimal;

/** How a purchase was counted: by weight, by volume, or by the piece. */
public enum PurchaseUnit {

	G(Measure.MASS, "1"), KG(Measure.MASS, "1000"), ML(Measure.VOLUME, "1"), CL(Measure.VOLUME, "10"),
	L(Measure.VOLUME, "1000"), PIECE(Measure.PIECE, "1");

	/** What it measures; a price is compared per gram, per millilitre or per piece. */
	public enum Measure {
		MASS, VOLUME, PIECE
	}

	private final Measure measure;

	/** In grams, millilitres or pieces. */
	private final BigDecimal base;

	PurchaseUnit(Measure measure, String base) {
		this.measure = measure;
		this.base = new BigDecimal(base);
	}

	public Measure measure() {
		return measure;
	}

	/** {@code quantity} of this unit, in grams, millilitres or pieces. */
	public BigDecimal toBase(BigDecimal quantity) {
		return quantity.multiply(base);
	}

}
