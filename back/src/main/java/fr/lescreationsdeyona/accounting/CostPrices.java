package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.PurchaseUnit.Measure;
import fr.lescreationsdeyona.common.Texts;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
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

	/** Recipe units, folded (lower case, without accents nor dots): what they measure, and how much of it. */
	private static final Map<String, Amount> UNITS = Map.ofEntries(unit("g", Measure.MASS, "1"), unit("gr", Measure.MASS, "1"),
			unit("gramme", Measure.MASS, "1"), unit("grammes", Measure.MASS, "1"), unit("kg", Measure.MASS, "1000"),
			unit("kilo", Measure.MASS, "1000"), unit("kilos", Measure.MASS, "1000"), unit("mg", Measure.MASS, "0.001"),
			unit("ml", Measure.VOLUME, "1"), unit("cl", Measure.VOLUME, "10"), unit("dl", Measure.VOLUME, "100"),
			unit("l", Measure.VOLUME, "1000"), unit("litre", Measure.VOLUME, "1000"), unit("litres", Measure.VOLUME, "1000"),
			unit("c a soupe", Measure.VOLUME, "15"), unit("cuillere a soupe", Measure.VOLUME, "15"),
			unit("cuilleres a soupe", Measure.VOLUME, "15"), unit("cs", Measure.VOLUME, "15"), unit("c s", Measure.VOLUME, "15"),
			unit("cas", Measure.VOLUME, "15"), unit("c a s", Measure.VOLUME, "15"), unit("c a cafe", Measure.VOLUME, "5"),
			unit("cuillere a cafe", Measure.VOLUME, "5"), unit("cuilleres a cafe", Measure.VOLUME, "5"),
			unit("cc", Measure.VOLUME, "5"), unit("c c", Measure.VOLUME, "5"), unit("cac", Measure.VOLUME, "5"),
			unit("c a c", Measure.VOLUME, "5"), unit("pincee", Measure.MASS, "0.5"), unit("pincees", Measure.MASS, "0.5"));

	private CostPrices() {
	}

	/** So much of a measure: grams, millilitres or pieces. */
	record Amount(Measure measure, BigDecimal base) {
	}

	private static Map.Entry<String, Amount> unit(String name, Measure measure, String base) {
		return Map.entry(name, new Amount(measure, new BigDecimal(base)));
	}

	/** "250" "g" → 250 g; "2" "c. à soupe" → 30 ml; "3" without unit, or "1" "gousse" → pieces. */
	static Amount amount(BigDecimal quantity, @Nullable String unit) {
		Amount one = unit == null ? null : UNITS.get(fold(unit));
		return one == null ? new Amount(Measure.PIECE, quantity) : new Amount(one.measure(), one.base().multiply(quantity));
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

	private static String fold(String unit) {
		return SPACES.matcher(Texts.foldCaseAndAccents(unit).replace('.', ' ').replace('\'', ' ')).replaceAll(" ").strip();
	}

}
