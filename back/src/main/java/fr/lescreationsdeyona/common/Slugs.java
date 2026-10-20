package fr.lescreationsdeyona.common;

import java.util.function.Predicate;
import java.util.regex.Pattern;

/** URL slugs: "Crème brûlée" becomes "creme-brulee", then "creme-brulee-2" if already taken. */
public final class Slugs {

	private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

	private static final Pattern EDGE_DASHES = Pattern.compile("^-+|-+$");

	private Slugs() {
	}

	public static String uniqueSlug(String text, String fallback, Predicate<String> isTaken) {
		String base = slugify(text);
		if (base.isEmpty()) {
			base = fallback;
		}
		String slug = base;
		for (int suffix = 2; isTaken.test(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		return slug;
	}

	static String slugify(String text) {
		String dashed = NON_ALPHANUMERIC.matcher(Texts.foldCaseAndAccents(text)).replaceAll("-");
		return EDGE_DASHES.matcher(dashed).replaceAll("");
	}

}
