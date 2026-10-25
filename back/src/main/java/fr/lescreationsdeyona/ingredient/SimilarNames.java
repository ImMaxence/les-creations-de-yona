package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.common.Texts;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Groups names that are probably the same ingredient written twice: "Pomme" and "pommes",
 * "Pommes de terre" and "pomme de terre", "Échalote" and "Echalotte". Names that only share a word
 * ("Sucre" and "Sucre glace") stay apart: they are different ingredients.
 */
final class SimilarNames {

	private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

	/** Below this length, a single different letter often makes another word ("poire", "poivre"). */
	private static final int MIN_LENGTH_FOR_TYPO = 6;

	private static final int MIN_LENGTH_FOR_TWO_TYPOS = 12;

	private SimilarNames() {
	}

	/** Groups of 2 or more, in the order of their first item. */
	static <T> List<List<T>> groups(List<T> items, Function<T, String> name) {
		List<String> keys = items.stream().map(item -> key(name.apply(item))).toList();
		int[] parents = new int[items.size()];
		Arrays.setAll(parents, index -> index);
		for (int first = 0; first < items.size(); first++) {
			for (int second = first + 1; second < items.size(); second++) {
				if (similar(keys.get(first), keys.get(second))) {
					parents[root(parents, second)] = root(parents, first);
				}
			}
		}
		Map<Integer, List<T>> groups = new LinkedHashMap<>();
		for (int index = 0; index < items.size(); index++) {
			groups.computeIfAbsent(root(parents, index), group -> new ArrayList<>()).add(items.get(index));
		}
		return groups.values().stream().filter(group -> group.size() > 1).toList();
	}

	/** "Pommes de Terre !" becomes "pomme de terre": case, accents, punctuation and plurals ignored. */
	static String key(String name) {
		return Arrays.stream(NON_ALPHANUMERIC.split(Texts.foldCaseAndAccents(name)))
			.filter(word -> !word.isEmpty())
			.map(SimilarNames::singular)
			.collect(Collectors.joining(" "));
	}

	private static boolean similar(String first, String second) {
		if (first.equals(second)) {
			return true;
		}
		int shortest = Math.min(first.length(), second.length());
		if (shortest < MIN_LENGTH_FOR_TYPO) {
			return false;
		}
		int allowed = shortest >= MIN_LENGTH_FOR_TWO_TYPOS ? 2 : 1;
		return Math.abs(first.length() - second.length()) <= allowed && distance(first, second) <= allowed;
	}

	/** French plurals in -s and -x ("choux"), on words long enough not to be cut ("riz", "gras"). */
	private static String singular(String word) {
		return word.length() > 3 && (word.endsWith("s") || word.endsWith("x"))
				? word.substring(0, word.length() - 1)
				: word;
	}

	/** Levenshtein distance: letters to add, remove or change to go from one to the other. */
	private static int distance(String first, String second) {
		int[] previous = new int[second.length() + 1];
		int[] current = new int[second.length() + 1];
		Arrays.setAll(previous, index -> index);
		for (int i = 1; i <= first.length(); i++) {
			current[0] = i;
			for (int j = 1; j <= second.length(); j++) {
				int substitution = previous[j - 1] + (first.charAt(i - 1) == second.charAt(j - 1) ? 0 : 1);
				current[j] = Math.min(substitution, Math.min(previous[j], current[j - 1]) + 1);
			}
			int[] swap = previous;
			previous = current;
			current = swap;
		}
		return previous[second.length()];
	}

	private static int root(int[] parents, int index) {
		while (parents[index] != index) {
			parents[index] = parents[parents[index]];
			index = parents[index];
		}
		return index;
	}

}
