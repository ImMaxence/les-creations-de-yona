package fr.lescreationsdeyona.common;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * What a visitor types in the search box, as words to look for: "Recette de tarte aux pommes pour 8
 * personnes" gives "tarte", "pomme". Case, accents and hyphens ignored ("petit-déjeuner" and "petit
 * dejeuner" are the same), small words and "recette" left out, a number of people too (the recipe
 * page adapts the quantities to it), plurals brought back to the singular.
 */
public final class SearchWords {

	/** Enough for any real search, and a bound on the SQL built from it. */
	public static final int MAX_WORDS = 6;

	/** "pour 8 personnes", "8 pers.", "6 parts", "10 couverts". */
	private static final Pattern SERVINGS = Pattern
		.compile("(?:pour\\s+)?\\d+\\s*(?:personnes?|pers\\.?|parts?|portions?|couverts?|gourmands?|enfants?)(?![\\p{L}])");

	/** Anything but letters and digits separates words. */
	private static final Pattern SEPARATORS = Pattern.compile("[^\\p{L}\\p{N}]+");

	private static final Set<String> IGNORED = Set.of("a", "au", "aux", "avec", "d", "de", "des", "du", "en", "et", "l",
			"la", "le", "les", "ou", "pour", "un", "une", "recette", "recettes", "idee", "idees");

	private SearchWords() {
	}

	/** Folded words, each once, at most {@link #MAX_WORDS}; empty when nothing is left to look for. */
	public static List<String> of(String text) {
		String folded = Texts.foldCaseAndAccents(text);
		folded = SERVINGS.matcher(folded).replaceAll(" ");
		Set<String> words = new LinkedHashSet<>();
		for (String word : SEPARATORS.split(folded)) {
			if (word.length() >= 2 && !IGNORED.contains(word) && words.size() < MAX_WORDS) {
				words.add(singular(word));
			}
		}
		return new ArrayList<>(words);
	}

	/** Found in {@code text}, case and accents ignored: each word, anywhere ("dejeuner" in "Petit-déjeuner"). */
	public static boolean allIn(List<String> words, String text) {
		String folded = Texts.foldCaseAndAccents(text);
		return !words.isEmpty() && words.stream().allMatch(folded::contains);
	}

	/**
	 * "pommes" and "gâteaux" looked for as "pomme" and "gateau", found in the singular and the
	 * plural alike; short words ("sans", "noix") and words in -ss ("cross") are left as they are.
	 */
	private static String singular(String word) {
		if (word.length() > 4 && (word.endsWith("x") || (word.endsWith("s") && !word.endsWith("ss")))) {
			return word.substring(0, word.length() - 1);
		}
		return word;
	}

}
