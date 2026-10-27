package fr.lescreationsdeyona.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class SlugsTest {

	@Test
	void slugifiesWithoutAccentsNorPunctuation() {
		assertThat(Slugs.slugify("Crème brûlée")).isEqualTo("creme-brulee");
		assertThat(Slugs.slugify("  Œufs  à la neige !")).isEqualTo("oeufs-a-la-neige");
		assertThat(Slugs.slugify("Pâte à choux (classique)")).isEqualTo("pate-a-choux-classique");
	}

	@Test
	void addsASuffixWhileTaken() {
		Set<String> taken = Set.of("creme-brulee", "creme-brulee-2");
		assertThat(Slugs.uniqueSlug("Crème brûlée", "recette", taken::contains)).isEqualTo("creme-brulee-3");
		assertThat(Slugs.uniqueSlug("Tarte", "recette", taken::contains)).isEqualTo("tarte");
	}

	@Test
	void fallsBackWhenNothingIsLeft() {
		assertThat(Slugs.uniqueSlug("🍰 !", "recette", slug -> false)).isEqualTo("recette");
		assertThat(Slugs.uniqueSlug("🍰", "recette", "recette"::equals)).isEqualTo("recette-2");
	}

}
