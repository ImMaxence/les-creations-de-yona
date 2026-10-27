package fr.lescreationsdeyona.ingredient;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class SimilarNamesTest {

	private static List<List<String>> groups(String... names) {
		return SimilarNames.groups(List.of(names), Function.identity());
	}

	@Test
	void ignoresCaseAccentsPunctuationAndPlurals() {
		assertThat(SimilarNames.key("Pommes de Terre !")).isEqualTo("pomme de terre");
		assertThat(SimilarNames.key("Choux")).isEqualTo("chou");
		// Too short to be a plural
		assertThat(SimilarNames.key("Riz")).isEqualTo("riz");
	}

	@Test
	void groupsTheSameIngredientWrittenTwice() {
		assertThat(groups("Pomme", "Sucre", "pommes", "Pommes de terre", "pomme de terre"))
			.containsExactly(List.of("Pomme", "pommes"), List.of("Pommes de terre", "pomme de terre"));
	}

	@Test
	void allowsATypoOnLongEnoughNames() {
		assertThat(groups("Échalote", "Echalotte")).containsExactly(List.of("Échalote", "Echalotte"));
		// Two typos from 12 letters
		assertThat(groups("Bicarbonate de soude", "Bicarbonatte de soudde")).hasSize(1);
	}

	@Test
	void keepsApartShortNamesAndNamesSharingAWord() {
		assertThat(groups("Poire", "Poivre")).isEmpty();
		assertThat(groups("Sucre", "Sucre glace")).isEmpty();
		// A single typo below 12 letters
		assertThat(groups("Échalote", "Echallottes")).isEmpty();
	}

	@Test
	void joinsGroupsThroughACommonName() {
		assertThat(groups("Cassonade", "Cassonnade", "Casonnade")).containsExactly(
				List.of("Cassonade", "Cassonnade", "Casonnade"));
	}

}
