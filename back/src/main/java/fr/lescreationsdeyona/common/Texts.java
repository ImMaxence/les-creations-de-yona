package fr.lescreationsdeyona.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Texts {

	private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");

	private Texts() {
	}

	/** "Crème Brûlée" becomes "creme brulee", like PostgreSQL's {@code unaccent(lower(...))}. */
	public static String foldCaseAndAccents(String text) {
		// Ligatures have no Unicode decomposition, so they are spelled out first.
		String lowerCase = text.toLowerCase(Locale.ROOT).replace("œ", "oe").replace("æ", "ae");
		return DIACRITICS.matcher(Normalizer.normalize(lowerCase, Normalizer.Form.NFD)).replaceAll("");
	}

}
