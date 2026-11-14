package fr.lescreationsdeyona.common;

import java.math.BigDecimal;
import java.util.Map;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * The units the recipes are written in ("250 g", "2 c. à soupe", "1 pincée"): what they measure, and how much of
 * it. Spoons are 15 ml and 5 ml, a pinch half a gram; any other unit ("gousse", "sachet", none) counts pieces.
 * Used by the cost prices and the nutrition facts.
 */
public final class Quantities {

	private static final Pattern SPACES = Pattern.compile("\\s+");

	/** A weight or a volume; pieces have no unit of their own. */
	public enum Kind {
		MASS, VOLUME
	}

	/** One of the unit: so many grams or millilitres. */
	public record Unit(Kind kind, BigDecimal base) {
	}

	/** Recipe units, folded (lower case, without accents nor dots). */
	private static final Map<String, Unit> UNITS = Map.ofEntries(unit("g", Kind.MASS, "1"), unit("gr", Kind.MASS, "1"),
			unit("gramme", Kind.MASS, "1"), unit("grammes", Kind.MASS, "1"), unit("kg", Kind.MASS, "1000"),
			unit("kilo", Kind.MASS, "1000"), unit("kilos", Kind.MASS, "1000"), unit("mg", Kind.MASS, "0.001"),
			unit("ml", Kind.VOLUME, "1"), unit("cl", Kind.VOLUME, "10"), unit("dl", Kind.VOLUME, "100"),
			unit("l", Kind.VOLUME, "1000"), unit("litre", Kind.VOLUME, "1000"), unit("litres", Kind.VOLUME, "1000"),
			unit("c a soupe", Kind.VOLUME, "15"), unit("cuillere a soupe", Kind.VOLUME, "15"),
			unit("cuilleres a soupe", Kind.VOLUME, "15"), unit("cs", Kind.VOLUME, "15"), unit("c s", Kind.VOLUME, "15"),
			unit("cas", Kind.VOLUME, "15"), unit("c a s", Kind.VOLUME, "15"), unit("c a cafe", Kind.VOLUME, "5"),
			unit("cuillere a cafe", Kind.VOLUME, "5"), unit("cuilleres a cafe", Kind.VOLUME, "5"),
			unit("cc", Kind.VOLUME, "5"), unit("c c", Kind.VOLUME, "5"), unit("cac", Kind.VOLUME, "5"),
			unit("c a c", Kind.VOLUME, "5"), unit("pincee", Kind.MASS, "0.5"), unit("pincees", Kind.MASS, "0.5"));

	private Quantities() {
	}

	private static Map.Entry<String, Unit> unit(String name, Kind kind, String base) {
		return Map.entry(name, new Unit(kind, new BigDecimal(base)));
	}

	/** "c. à soupe" → 15 ml; null for a unit counting pieces ("gousse"), or none. */
	public static @Nullable Unit unit(@Nullable String unit) {
		return unit == null ? null : UNITS.get(fold(unit));
	}

	/**
	 * {@code quantity} of {@code unit}, in grams: a millilitre taken as a gram, pieces through the weight of
	 * one ({@code pieceGrams}). Null for pieces of an unknown weight.
	 */
	public static @Nullable BigDecimal grams(BigDecimal quantity, @Nullable String unit, @Nullable BigDecimal pieceGrams) {
		Unit one = unit(unit);
		if (one != null) {
			return one.base().multiply(quantity);
		}
		return pieceGrams == null || pieceGrams.signum() <= 0 ? null : pieceGrams.multiply(quantity);
	}

	private static String fold(String unit) {
		return SPACES.matcher(Texts.foldCaseAndAccents(unit).replace('.', ' ').replace('\'', ' ')).replaceAll(" ").strip();
	}

}
