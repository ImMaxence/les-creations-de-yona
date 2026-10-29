package fr.lescreationsdeyona.common;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * What a visitor types in the search box, as words to look for: "Recette de tarte aux pommes pour 8
 * personnes" gives "tarte", "pomme". Case, accents and hyphens ignored ("petit-déjeuner" and "petit
 * dejeuner" are the same), small words and "recette" left out, a number of people too ("8
 * personnes", or a number alone: "gâteau 8"; the recipe page adapts the quantities to it), and the
 * theme ("sucré", "salée": see {@link #theme}), plurals brought back to the singular.
 */
public final class SearchWords {

	/** Enough for any real search, and a bound on the SQL built from it. */
	public static final int MAX_WORDS = 6;

	/** Names of the themes of fr.lescreationsdeyona.recipe.RecipeTheme. */
	public static final String SWEET = "SWEET";

	public static final String SAVORY = "SAVORY";

	/**
	 * "pour 8 personnes", "8 pers.", "6 parts", "10 couverts", or a number alone, not followed by a
	 * word ("gâteau 8", but not "4 quarts").
	 */
	private static final Pattern SERVINGS = Pattern.compile(
			"(?:pour\\s+)?(?<![\\p{L}\\p{N}])\\d{1,2}(?:\\s*(?:personnes?|pers\\.?|parts?|portions?|couverts?|gourmands?|enfants?)(?![\\p{L}])"
					+ "|(?![\\p{L}\\p{N}])(?!\\s*\\p{L}))");

	/**
	 * Accents matter here: "sucre" is the ingredient, "sucré" the theme. Without accent, only the
	 * spellings that are no other word ("sucree", "sale").
	 */
	private static final Pattern SWEET_WORD = Pattern.compile("(?<![\\p{L}\\p{N}])sucr(?:é|ée|és|ées|ee|ees)(?![\\p{L}\\p{N}])");

	private static final Pattern SAVORY_WORD = Pattern
		.compile("(?<![\\p{L}\\p{N}])sal(?:é|ée|és|ées|e|es|ee|ees)(?![\\p{L}\\p{N}])");

	/** Anything but letters and digits separates words. */
	private static final Pattern SEPARATORS = Pattern.compile("[^\\p{L}\\p{N}]+");

	private static final Set<String> IGNORED = Set.of("a", "au", "aux", "avec", "d", "de", "des", "du", "en", "et", "l",
			"la", "le", "les", "ou", "pour", "un", "une", "recette", "recettes", "idee", "idees");

	private SearchWords() {
	}

	/** Folded words, each once, at most {@link #MAX_WORDS}; empty when nothing is left to look for. */
	public static List<String> of(String text) {
		String lower = Normalizer.normalize(text, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
		lower = SWEET_WORD.matcher(lower).replaceAll(" ");
		lower = SAVORY_WORD.matcher(lower).replaceAll(" ");
		String folded = SERVINGS.matcher(Texts.foldCaseAndAccents(lower)).replaceAll(" ");
		Set<String> words = new LinkedHashSet<>();
		for (String word : SEPARATORS.split(folded)) {
			if (word.length() >= 2 && !IGNORED.contains(word) && words.size() < MAX_WORDS) {
				words.add(singular(word));
			}
		}
		return new ArrayList<>(words);
	}

	/** {@link #SWEET} for "gâteau sucré", {@link #SAVORY} for "cake salé"; null for none, or both. */
	public static @Nullable String theme(String text) {
		String lower = Normalizer.normalize(text, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
		boolean sweet = SWEET_WORD.matcher(lower).find();
		boolean savory = SAVORY_WORD.matcher(lower).find();
		return sweet == savory ? null : sweet ? SWEET : SAVORY;
	}

	/** Found in {@code text}, case and accents ignored: each word, anywhere ("dejeuner" in "Petit-déjeuner"). */
	public static boolean allIn(List<String> words, String text) {
		String folded = Texts.foldCaseAndAccents(text);
		return !words.isEmpty() && words.stream().allMatch(folded::contains);
	}

	/**
	 * A name whose every word is among the words typed, plural or not: "Yaourt" for "gâteau au
	 * yaourt", "Pommes" for "tarte pomme", "Pâte feuilletée" for "tarte pâte feuilletée". What a
	 * search names among other words.
	 */
	public static boolean isOneOf(List<String> words, String name) {
		List<String> named = of(name);
		return !named.isEmpty() && words.containsAll(named);
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
