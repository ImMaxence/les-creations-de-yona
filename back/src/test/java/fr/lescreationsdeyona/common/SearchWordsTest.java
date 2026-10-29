package fr.lescreationsdeyona.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SearchWordsTest {

	@Test
	void keepsTheWordsThatSayWhatToLookFor() {
		assertThat(SearchWords.of("Recette de tarte aux pommes pour 8 personnes")).containsExactly("tarte", "pomme");
		assertThat(SearchWords.of("Petit-Déjeuner")).containsExactly("petit", "dejeuner");
		assertThat(SearchWords.of("gâteaux sans gluten")).containsExactly("gateau", "sans", "gluten");
		assertThat(SearchWords.of("Œufs à la neige")).containsExactly("oeuf", "neige");
	}

	@Test
	void leavesOutANumberOfPeople() {
		assertThat(SearchWords.of("recette 8 personnes")).isEmpty();
		assertThat(SearchWords.of("brioche 6 parts")).containsExactly("brioche");
		assertThat(SearchWords.of("lasagnes 10 pers.")).containsExactly("lasagne");
		// A number alone is a number of people too, unless a word follows it: "3 chocolats"
		assertThat(SearchWords.of("gâteau 12")).containsExactly("gateau");
		assertThat(SearchWords.of("gâteau pour 4")).containsExactly("gateau");
		assertThat(SearchWords.of("3 chocolats")).containsExactly("chocolat");
		assertThat(SearchWords.of("quatre-quarts 4 quarts")).containsExactly("quatre", "quart");
	}

	@Test
	void takesTheThemeOutOfTheWords() {
		assertThat(SearchWords.of("cake salé")).containsExactly("cake");
		assertThat(SearchWords.of("tartes sucrées")).containsExactly("tarte");
		assertThat(SearchWords.theme("cake salé")).isEqualTo(SearchWords.SAVORY);
		assertThat(SearchWords.theme("Tartes SUCRÉES")).isEqualTo(SearchWords.SWEET);
		assertThat(SearchWords.theme("quiche sale")).isEqualTo(SearchWords.SAVORY);
	}

	@Test
	void understandsATime() {
		assertThat(SearchWords.maxMinutes("tarte en 30 min")).isEqualTo(30);
		assertThat(SearchWords.maxMinutes("dessert moins de 45 minutes")).isEqualTo(45);
		assertThat(SearchWords.maxMinutes("brioche 1h30")).isEqualTo(90);
		assertThat(SearchWords.maxMinutes("pain 2 heures")).isEqualTo(120);
		assertThat(SearchWords.maxMinutes("gâteau 8")).isNull();
		assertThat(SearchWords.maxMinutes("2 hamburgers")).isNull();
		assertThat(SearchWords.of("tarte en 30 min")).containsExactly("tarte");
		assertThat(SearchWords.of("dessert moins de 45 minutes")).containsExactly("dessert");
		assertThat(SearchWords.of("brioche 1h30 pour 6")).containsExactly("brioche");
	}

	@Test
	void understandsQuickEasyAndNoCooking() {
		assertThat(SearchWords.quick("Dessert rapide")).isTrue();
		assertThat(SearchWords.quick("apéro vite fait")).isTrue();
		assertThat(SearchWords.easy("gâteau facile")).isTrue();
		assertThat(SearchWords.noCooking("cheesecake sans cuisson")).isTrue();
		assertThat(SearchWords.noCooking("gâteau sans gluten")).isFalse();
		assertThat(SearchWords.of("gâteau facile et rapide")).containsExactly("gateau");
		assertThat(SearchWords.of("cheesecake sans cuisson")).containsExactly("cheesecake");
	}

	@Test
	void keepsSugarAnIngredient() {
		// Without its accent, "sucre" is the ingredient, not the theme
		assertThat(SearchWords.of("tarte au sucre")).containsExactly("tarte", "sucre");
		assertThat(SearchWords.theme("tarte au sucre")).isNull();
		assertThat(SearchWords.theme("sucré salé")).isNull();
		assertThat(SearchWords.theme("salade")).isNull();
	}

	@Test
	void findsEachWordInAName() {
		List<String> words = SearchWords.of("petit dejeuner");

		assertThat(SearchWords.allIn(words, "Petit-déjeuner")).isTrue();
		assertThat(SearchWords.allIn(words, "Déjeuner")).isFalse();
		assertThat(SearchWords.allIn(SearchWords.of("pommes"), "Tarte aux pommes")).isTrue();
		assertThat(SearchWords.allIn(List.of(), "Tarte")).isFalse();
	}

	@Test
	void findsTheNameThatIsOneOfTheWords() {
		List<String> words = SearchWords.of("gâteau au yaourt");

		assertThat(SearchWords.isOneOf(words, "Yaourt")).isTrue();
		assertThat(SearchWords.isOneOf(SearchWords.of("tarte pomme"), "Pommes")).isTrue();
		assertThat(SearchWords.isOneOf(SearchWords.of("tarte pâte feuilletée"), "Pâte feuilletée")).isTrue();
		assertThat(SearchWords.isOneOf(words, "Yaourt grec")).isFalse();
	}

}
