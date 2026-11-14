package fr.lescreationsdeyona.ingredient;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class UsualWeightsTest {

	private static IngredientUsual usual(String grams, String singular, String plural, Integer ediblePercent) {
		return new IngredientUsual(new IngredientPiece(new BigDecimal(grams), singular, plural), ediblePercent);
	}

	@Test
	void knowsTheCommonIngredientsWhateverTheirSpelling() {
		assertThat(UsualWeights.of("Œufs")).isEqualTo(usual("50", "œuf", "œufs", null));
		assertThat(UsualWeights.of("Gousses d'ail")).isEqualTo(usual("5", "gousse", "gousses", null));
		assertThat(UsualWeights.of("Ail")).isEqualTo(usual("5", "gousse", "gousses", null));
		assertThat(UsualWeights.of("Ananas")).isEqualTo(usual("1200", "ananas", "ananas", 51));
		assertThat(UsualWeights.of("Jaunes d'œufs")).isEqualTo(usual("20", "jaune", "jaunes", null));
	}

	@Test
	void readsTheFirstWordsOfALongerName() {
		assertThat(UsualWeights.of("Poulet fermier")).isEqualTo(usual("1500", "poulet", "poulets", 68));
		assertThat(UsualWeights.of("Pâte feuilletée pur beurre")).isEqualTo(usual("230", "rouleau", "rouleaux", null));
		assertThat(UsualWeights.of("Pommes Golden")).isEqualTo(usual("150", "pomme", "pommes", 90));
		// The longest name known first
		assertThat(UsualWeights.of("Pommes de terre")).isEqualTo(usual("150", "pomme de terre", "pommes de terre", 85));
		assertThat(UsualWeights.of("Tomates cerises")).isEqualTo(usual("15", "tomate cerise", "tomates cerises", null));
	}

	@Test
	void leavesOutWhatOnlyEndsLikeAKnownIngredient() {
		assertThat(UsualWeights.of("Blanc de poulet")).isNull();
		assertThat(UsualWeights.of("Jus de citron")).isNull();
		assertThat(UsualWeights.of("Farine")).isNull();
		assertThat(UsualWeights.of("")).isNull();
	}

}
