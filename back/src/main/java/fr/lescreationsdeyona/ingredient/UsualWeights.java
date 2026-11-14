package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.nutrition.CiqualSearch;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * The usual weight of one piece of the common ingredients, and the share of them eaten (bones, skin, peel, stones
 * left): orders of magnitude, offered to the admin so that a recipe in pieces ("1 rouleau", "2 gousses") counts
 * without weighing anything. An egg is weighed without its shell, as in pastry.
 */
final class UsualWeights {

	/** By ingredient, folded as {@link CiqualSearch#key} ("Gousses d'ail" → "gousse ail", "ananas" → "anana"). */
	private static final Map<String, IngredientUsual> USUAL = Map.ofEntries(piece("oeuf", "50", "œuf", "œufs"),
			piece("jaune oeuf", "20", "jaune", "jaunes"), piece("blanc oeuf", "30", "blanc", "blancs"),
			piece("ail", "5", "gousse", "gousses"), piece("gousse ail", "5", "gousse", "gousses"),
			piece("echalote", "30", "échalote", "échalotes", 90), piece("oignon", "100", "oignon", "oignons", 90),
			piece("carotte", "100", "carotte", "carottes", 90), piece("pomme", "150", "pomme", "pommes", 90),
			piece("poire", "150", "poire", "poires", 90), piece("banane", "180", "banane", "bananes", 64),
			piece("orange", "200", "orange", "oranges", 73), piece("clementine", "70", "clémentine", "clémentines", 74),
			piece("citron", "120", "citron", "citrons"), piece("citron vert", "70", "citron vert", "citrons verts"),
			piece("avocat", "200", "avocat", "avocats", 74), piece("mangue", "400", "mangue", "mangues", 69),
			piece("ananas", "1200", "ananas", "ananas", 51), piece("kiwi", "80", "kiwi", "kiwis", 86),
			piece("tomate", "120", "tomate", "tomates"), piece("tomate cerise", "15", "tomate cerise", "tomates cerises"),
			piece("courgette", "250", "courgette", "courgettes"), piece("aubergine", "300", "aubergine", "aubergines"),
			piece("poivron", "150", "poivron", "poivrons", 82), piece("concombre", "300", "concombre", "concombres"),
			piece("pomme terre", "150", "pomme de terre", "pommes de terre", 85),
			piece("potimarron", "1000", "potimarron", "potimarrons", 85),
			piece("butternut", "1000", "butternut", "butternuts", 84), piece("poulet", "1500", "poulet", "poulets", 68),
			piece("pate feuilletee", "230", "rouleau", "rouleaux"), piece("pate brisee", "230", "rouleau", "rouleaux"),
			piece("pate sablee", "230", "rouleau", "rouleaux"), piece("pate pizza", "260", "rouleau", "rouleaux"),
			piece("yaourt", "125", "pot", "pots"), piece("mozzarella", "125", "boule", "boules"),
			piece("levure chimique", "11", "sachet", "sachets"), piece("sucre vanille", "7.5", "sachet", "sachets"),
			piece("gelatine", "2", "feuille", "feuilles"), piece("vanille", "3", "gousse", "gousses"),
			piece("gousse vanille", "3", "gousse", "gousses"), piece("thym", "1", "branche", "branches"),
			piece("romarin", "1", "branche", "branches"), piece("laurier", "0.2", "feuille", "feuilles"),
			piece("persil", "30", "bouquet", "bouquets"), piece("coriandre", "30", "bouquet", "bouquets"),
			piece("ciboulette", "20", "bouquet", "bouquets"), piece("basilic", "20", "bouquet", "bouquets"),
			piece("menthe", "20", "bouquet", "bouquets"), piece("jambon", "45", "tranche", "tranches"),
			piece("pain mie", "25", "tranche", "tranches"), piece("cube bouillon", "10", "cube", "cubes"),
			piece("bouillon cube", "10", "cube", "cubes"));

	private UsualWeights() {
	}

	/**
	 * What such an ingredient usually weighs, by its name or its first words ("Poulet fermier" is a chicken, "Blanc de
	 * poulet" is not); null for an ingredient not in the list.
	 */
	static @Nullable IngredientUsual of(String name) {
		List<String> words = List.of(CiqualSearch.key(name).split(" "));
		for (int count = words.size(); count > 0; count--) {
			IngredientUsual usual = USUAL.get(String.join(" ", words.subList(0, count)));
			if (usual != null) {
				return usual;
			}
		}
		return null;
	}

	/** All of it eaten. */
	private static Map.Entry<String, IngredientUsual> piece(String key, String grams, String singular, String plural) {
		return piece(key, grams, singular, plural, null);
	}

	private static Map.Entry<String, IngredientUsual> piece(String key, String grams, String singular, String plural,
			@Nullable Integer ediblePercent) {
		return Map.entry(CiqualSearch.key(key),
				new IngredientUsual(new IngredientPiece(new BigDecimal(grams), singular, plural), ediblePercent));
	}

}
