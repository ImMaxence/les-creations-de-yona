package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class CiqualSearchTest {

	private static CiqualFood food(int code, String name, String subgroup) {
		return new CiqualFood(code, name, subgroup, null, NutritionFacts.NONE);
	}

	/** Names of the 2025 table. */
	private static final List<CiqualFood> FOODS = List.of(food(16400, "Beurre à 80% MG minimum, doux", "0901"),
			food(16402, "Beurre à 80% MG, demi-sel", "0901"),
			food(16414, "Beurre ou assimilé sans précision sur la teneur en matière grasse, doux (aliment moyen)", "0901"),
			food(15202, "Beurre de cacahuète ou pâte d'arachide", "0205"), food(22000, "Oeuf cru", "0410"),
			food(22002, "Oeuf, jaune (jaune d'oeuf), cru", "0410"), food(22010, "Oeuf dur", "0410"),
			food(8380, "Oeuf au jambon en gelée", "0403"), food(9440, "Farine de blé tendre ou froment T45 (pour pâtisserie)", "0304"),
			food(9436, "Farine de blé tendre ou froment T55 (pour pains)", "0304"), food(9540, "Farine de riz", "0304"),
			food(13396, "Pomme, chair sans peau, crue (aliment moyen)", "0204"), food(4003, "Pomme de terre, crue", "0202"),
			food(25000, "Gratin de pommes de terre", "0103"), food(31016, "Sucre blanc", "0701"),
			food(24430, "Biscuit sec aux oeufs à la cuillère (cuiller) ou boudoir", "0706"));

	private static List<Integer> codes(List<CiqualFood> foods) {
		return foods.stream().map(CiqualFood::code).toList();
	}

	@Test
	void findsWhatIsTypedFromTheStartOfItsWords() {
		assertThat(codes(CiqualSearch.search(FOODS, "beurre dou", 10))).containsExactly(16400, 16414);
		assertThat(codes(CiqualSearch.search(FOODS, "BOUDOIR", 10))).containsExactly(24430);
		assertThat(codes(CiqualSearch.search(FOODS, "farine T55", 10))).containsExactly(9436);
		assertThat(CiqualSearch.search(FOODS, "de la", 10)).isEmpty();
		assertThat(CiqualSearch.search(FOODS, "chocolat", 10)).isEmpty();
	}

	@Test
	void putsFirstTheFoodsNamedByTheFirstWord() {
		// Then the shortest names; the boudoir, "aux oeufs", last
		assertThat(codes(CiqualSearch.search(FOODS, "oeuf", 10))).containsExactly(22000, 22010, 8380, 22002, 24430);
	}

	@Test
	void suggestsTheUsualFoodOfACommonIngredient() {
		assertThat(codes(CiqualSearch.suggest(FOODS, "Beurre", 3))).startsWith(16400);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Farine", 3))).startsWith(9440);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Œufs", 3))).startsWith(22000);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Jaunes d'œufs", 3))).startsWith(22002);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Sucre en poudre", 3))).containsExactly(31016);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Pommes de terre", 1))).containsExactly(4003);
	}

	@Test
	void putsTheRawFoodBeforeTheCookedOne() {
		List<CiqualFood> foods = List.of(food(20357, "Potimarron, chair sans peau, cuit (aliment moyen)", "0201"),
				food(20132, "Potimarron, chair sans peau, cru", "0201"));

		assertThat(codes(CiqualSearch.suggest(foods, "Potimarron", 2))).containsExactly(20132, 20357);
	}

	@Test
	void suggestsByTheWordsOfTheName() {
		// Plural, accents and small words ignored; the average food of the table, raw, rather than a ready meal
		assertThat(codes(CiqualSearch.suggest(FOODS, "Pommes", 3))).containsExactly(13396, 4003, 25000);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Beurre demi-sel", 3))).startsWith(16402);
		assertThat(codes(CiqualSearch.suggest(FOODS, "Farine T55", 2))).containsExactly(9436, 9440);
		assertThat(CiqualSearch.suggest(FOODS, "Whey", 3)).isEmpty();
	}

	@Test
	void foldsNamesIntoTheirKey() {
		assertThat(CiqualSearch.key("Jaunes d'œufs")).isEqualTo("jaune oeuf");
		assertThat(CiqualSearch.key("Crème liquide entière")).isEqualTo("creme liquide entiere");
		assertThat(CiqualSearch.key("Pommes de terre")).isEqualTo("pomme terre");
		assertThat(CiqualSearch.words("Sucre en poudre")).containsExactly("sucre", "poudre");
	}

}
