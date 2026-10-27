package fr.lescreationsdeyona.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TextsTest {

	@Test
	void foldsCaseAndAccentsLikeUnaccentLower() {
		assertThat(Texts.foldCaseAndAccents("Crème Brûlée")).isEqualTo("creme brulee");
		assertThat(Texts.foldCaseAndAccents("ÉCLAIR")).isEqualTo("eclair");
	}

	@Test
	void spellsOutLigatures() {
		assertThat(Texts.foldCaseAndAccents("Œufs")).isEqualTo("oeufs");
		assertThat(Texts.foldCaseAndAccents("Cæsar")).isEqualTo("caesar");
	}

	@Test
	void capitalizesTheFirstLetterOnly() {
		assertThat(Texts.capitalizeFirstLetter("éclair au café")).isEqualTo("Éclair au café");
		assertThat(Texts.capitalizeFirstLetter("« tarte »")).isEqualTo("« Tarte »");
		assertThat(Texts.capitalizeFirstLetter("🍫 chocolat")).isEqualTo("🍫 Chocolat");
		assertThat(Texts.capitalizeFirstLetter("3 chocolats")).isEqualTo("3 chocolats");
		assertThat(Texts.capitalizeFirstLetter("")).isEmpty();
	}

}
