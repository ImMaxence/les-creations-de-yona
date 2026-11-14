package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.PurchaseUnit.Measure;
import fr.lescreationsdeyona.common.Quantities;
import fr.lescreationsdeyona.common.Texts;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * The arithmetic of cost prices: a quantity of a recipe ("250 g", "2 c. à soupe", "3" eggs) priced at
 * the last price paid for it ("9,80 € the kilo"). Weights and volumes are taken as equal (1 ml ≈ 1 g),
 * spoons as 15 ml and 5 ml, a pinch as half a gram; pieces and weights meet through the weight of one
 * piece of the ingredient, when known.
 */
final class CostPrices {

	private static final int SCALE = 6;

	private static final Pattern SPACES = Pattern.compile("\\s+");

	private CostPrices() {
	}

	/** So much of a measure: grams, millilitres or pieces. */
	record Amount(Measure measure, BigDecimal base) {
	}

	/** "250" "g" → 250 g; "2" "c. à soupe" → 30 ml; "3" without unit, or "1" "gousse" → pieces (see {@link Quantities}). */
	static Amount amount(BigDecimal quantity, @Nullable String unit) {
		Quantities.Unit one = Quantities.unit(unit);
		if (one == null) {
			return new Amount(Measure.PIECE, quantity);
		}
		return new Amount(one.kind() == Quantities.Kind.MASS ? Measure.MASS : Measure.VOLUME, one.base().multiply(quantity));
	}

	/** The price of one gram, one millilitre or one piece of a purchase. */
	static BigDecimal perBase(BigDecimal quantity, PurchaseUnit unit, BigDecimal price) {
		return price.divide(unit.toBase(quantity), SCALE, RoundingMode.HALF_UP);
	}

	/** As people read it: per kilo, per litre, or per piece. */
	static BigDecimal perUnit(BigDecimal perBase, Measure measure) {
		return (measure == Measure.PIECE ? perBase : perBase.multiply(BigDecimal.valueOf(1000))).setScale(2, RoundingMode.HALF_UP);
	}

	static PriceUnit priceUnit(Measure measure) {
		return switch (measure) {
			case MASS -> PriceUnit.KG;
			case VOLUME -> PriceUnit.L;
			case PIECE -> PriceUnit.PIECE;
		};
	}

	/**
	 * What {@code amount} costs at {@code perBase} per unit of {@code priced}; null when they cannot meet
	 * (pieces against a weight, without the weight of one piece).
	 */
	static @Nullable BigDecimal cost(Amount amount, Measure priced, BigDecimal perBase, @Nullable BigDecimal pieceGrams) {
		boolean amountByPiece = amount.measure() == Measure.PIECE;
		boolean pricedByPiece = priced == Measure.PIECE;
		BigDecimal base;
		if (amountByPiece == pricedByPiece) {
			// Same measure, or a weight against a volume (1 ml ≈ 1 g)
			base = amount.base();
		}
		else if (pieceGrams == null || pieceGrams.signum() <= 0) {
			return null;
		}
		else if (amountByPiece) {
			base = amount.base().multiply(pieceGrams);
		}
		else {
			base = amount.base().divide(pieceGrams, SCALE, RoundingMode.HALF_UP);
		}
		return base.multiply(perBase).setScale(2, RoundingMode.HALF_UP);
	}

	/** The same thing whatever its case and accents: "Beurre doux" and "beurre doux". */
	static String key(String name) {
		return SPACES.matcher(Texts.foldCaseAndAccents(name)).replaceAll(" ").strip();
	}

}
