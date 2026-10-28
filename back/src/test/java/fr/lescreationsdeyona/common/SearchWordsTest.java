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
		// A number alone stays: "3 chocolats"
		assertThat(SearchWords.of("3 chocolats")).containsExactly("chocolat");
	}

	@Test
	void findsEachWordInAName() {
		List<String> words = SearchWords.of("petit dejeuner");

		assertThat(SearchWords.allIn(words, "Petit-déjeuner")).isTrue();
		assertThat(SearchWords.allIn(words, "Déjeuner")).isFalse();
		assertThat(SearchWords.allIn(SearchWords.of("pommes"), "Tarte aux pommes")).isTrue();
		assertThat(SearchWords.allIn(List.of(), "Tarte")).isFalse();
	}

}
