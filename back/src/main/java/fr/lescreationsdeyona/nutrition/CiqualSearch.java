package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.common.Texts;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Finds foods of the Ciqual table by their name: what the admin types ("beurre dou"), or the food an ingredient
 * of the site most probably is ("Œufs" → "Oeuf cru"). Case, accents, plurals and small words are ignored.
 */
public final class CiqualSearch {

	private static final Pattern NOT_A_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");

	private static final Set<String> SMALL_WORDS = Set.of("de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux",
			"en", "et", "ou", "un", "une", "pour", "avec");

	/**
	 * What the recipes of a pastry chef mean by the most common ingredients, which the names alone leave open
	 * (a "Farine" is wheat flour for pastry, not rice flour): ingredient, folded as {@link #key}, and its food.
	 */
	private static final Map<String, Integer> USUAL_FOODS = Map.ofEntries(Map.entry("farine", 9440),
			Map.entry("farine ble", 9440), Map.entry("beurre", 16400), Map.entry("beurre doux", 16400),
			Map.entry("sucre", 31016), Map.entry("sucre poudre", 31016), Map.entry("sucre semoule", 31016),
			Map.entry("sucre blanc", 31016), Map.entry("cassonade", 31017), Map.entry("sucre roux", 31017),
			Map.entry("sucre vanille", 31044), Map.entry("oeuf", 22000), Map.entry("oeuf entier", 22000),
			Map.entry("jaune oeuf", 22002), Map.entry("jaune", 22002), Map.entry("blanc oeuf", 22001),
			Map.entry("lait", 19033), Map.entry("creme", 19417), Map.entry("creme liquide", 19417),
			Map.entry("creme liquide entiere", 19417), Map.entry("creme entiere", 19417),
			Map.entry("chocolat noir", 31085), Map.entry("chocolat noir patissier", 31085),
			Map.entry("chocolat patissier", 31085), Map.entry("chocolat lait", 31004), Map.entry("chocolat blanc", 31010),
			Map.entry("sel", 11058), Map.entry("sel fin", 11058), Map.entry("fleur sel", 11082), Map.entry("poivre", 11015),
			Map.entry("eau", 18066), Map.entry("miel", 31008), Map.entry("maizena", 9510), Map.entry("fecule mais", 9510),
			Map.entry("cacao", 18100), Map.entry("cacao poudre", 18100), Map.entry("gelatine", 11007),
			Map.entry("poudre amande", 15041), Map.entry("amande poudre", 15041), Map.entry("vanille", 11057),
			Map.entry("gousse vanille", 11057), Map.entry("extrait vanille", 11098), Map.entry("levure boulanger", 11010),
			Map.entry("jus citron", 2028), Map.entry("citron", 13009), Map.entry("citron vert", 13067), Map.entry("pomme", 13396),
			Map.entry("pomme terre", 4008), Map.entry("tahini", 15203), Map.entry("skyr", 19724));

	/** Cooked, fried, canned: a recipe starts from raw ingredients, they come after the raw ones. */
	private static final Set<String> PREPARED = Set.of("cuit", "cuite", "cuits", "cuites", "bouilli", "bouillie", "bouillis",
			"roti", "rotie", "grille", "grillee", "frit", "frite", "prefrit", "prefrite", "appertise", "appertisee");

	private CiqualSearch() {
	}

	/** What the admin types: each word the start of a word of the food, the closest names first. */
	public static List<CiqualFood> search(List<CiqualFood> foods, String query, int limit) {
		List<String> typed = words(query);
		if (typed.isEmpty()) {
			return List.of();
		}
		return foods.stream()
			.map(food -> new Scored(food, words(food.name())))
			.filter(scored -> typed.stream().allMatch(word -> scored.words().stream().anyMatch(own -> own.startsWith(word))))
			.sorted(Comparator.comparingDouble((Scored scored) -> -closeness(scored, typed.getFirst(), 0))
				.thenComparing(scored -> scored.food().name().length()))
			.limit(limit)
			.map(Scored::food)
			.toList();
	}

	/**
	 * The foods an ingredient most probably is, the likeliest first: its usual food when it is a common one,
	 * then those having its first word and most of the others.
	 */
	public static List<CiqualFood> suggest(List<CiqualFood> foods, String ingredientName, int limit) {
		List<String> named = words(ingredientName);
		if (named.isEmpty()) {
			return List.of();
		}
		Integer usual = USUAL_FOODS.get(key(ingredientName));
		List<CiqualFood> suggested = new ArrayList<>();
		if (usual != null) {
			foods.stream().filter(food -> food.code() == usual).findFirst().ifPresent(suggested::add);
		}
		String first = named.getFirst();
		// "Farine T55": among the foods that are not a T55, the usual flour rather than rice flour
		Integer usualOfFirst = USUAL_FOODS.get(singular(first));
		foods.stream()
			.filter(food -> usual == null || food.code() != usual)
			.map(food -> new Scored(food, words(food.name())))
			.filter(scored -> contains(scored.words(), first))
			.sorted(Comparator.comparingInt((Scored scored) -> -matched(scored.words(), named))
				.thenComparingDouble(scored -> -closeness(scored, first, matched(scored.words(), named))
						- (usualOfFirst != null && scored.food().code() == usualOfFirst ? 3 : 0))
				.thenComparing(scored -> scored.food().name().length()))
			.limit(Math.max(0, limit - suggested.size()))
			.map(Scored::food)
			.forEach(suggested::add);
		return suggested;
	}

	/** "Jaunes d'œufs" → "jaune oeuf": folded, small words left out, each word in the singular. */
	public static String key(String name) {
		return words(name).stream().map(CiqualSearch::singular).collect(Collectors.joining(" "));
	}

	private record Scored(CiqualFood food, List<String> words) {
	}

	/**
	 * Higher for a food named first by that word, an average food ("aliment moyen", the table's own default),
	 * a raw one, and a short name; lower for a cooked one, a ready meal or a baby food.
	 */
	private static double closeness(Scored scored, String first, int matched) {
		List<String> own = scored.words();
		double closeness = 0;
		if (!own.isEmpty() && (own.getFirst().startsWith(first) || sameWord(own.getFirst(), first))) {
			closeness += 3;
		}
		if (own.contains("moyen") && own.contains("aliment")) {
			closeness += 3;
		}
		if (own.contains("cru") || own.contains("crue")) {
			closeness += 1;
		}
		if (own.stream().anyMatch(PREPARED::contains)) {
			closeness -= 1;
		}
		String subgroup = scored.food().subgroupCode();
		if (subgroup.startsWith("01") || subgroup.startsWith("11")) {
			closeness -= 2;
		}
		if (own.stream().anyMatch(word -> word.startsWith("preemballe"))) {
			closeness -= 1;
		}
		return closeness - 0.5 * Math.max(0, own.size() - Math.max(matched, 1));
	}

	private static int matched(List<String> own, List<String> named) {
		return (int) named.stream().filter(word -> contains(own, word)).count();
	}

	private static boolean contains(List<String> own, String word) {
		return own.stream().anyMatch(other -> sameWord(other, word));
	}

	/** "oeufs" and "oeuf", "choux" and "chou": the same word. */
	private static boolean sameWord(String first, String second) {
		return first.equals(second) || singular(first).equals(singular(second));
	}

	private static String singular(String word) {
		return word.length() > 3 && (word.endsWith("s") || word.endsWith("x")) ? word.substring(0, word.length() - 1) : word;
	}

	static List<String> words(String text) {
		return Arrays.stream(NOT_A_WORD.split(Texts.foldCaseAndAccents(text)))
			.filter(word -> !word.isEmpty() && !SMALL_WORDS.contains(word))
			.toList();
	}

}
