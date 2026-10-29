package fr.lescreationsdeyona.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class AuditChangesTest {

	@Test
	void keepsOnlyTheFieldsThatChanged() {
		AuditChanges changes = new AuditChanges().add("Titre", "Tarte", "Tarte aux pommes")
			.add("Introduction", "  ", null)
			.add("Difficulté", new BigDecimal("2.50"), new BigDecimal("2.5"))
			.add("À la une", false, true);

		assertThat(changes.list()).containsExactly(new AuditChange("Titre", "Tarte", "Tarte aux pommes"),
				new AuditChange("À la une", "Non", "Oui"));
	}

	@Test
	void givesTheLinesRemovedAndAddedOfAList() {
		AuditChanges changes = new AuditChanges().addLines("Ingrédients", List.of("200 g Farine", "3 Œufs", "Sel"),
				List.of("250 g Farine", "3 Œufs", "Sel"));

		assertThat(changes.list()).containsExactly(new AuditChange("Ingrédients", "200 g Farine", "250 g Farine"));
	}

	@Test
	void numbersAListOnlyReordered() {
		AuditChanges changes = new AuditChanges().addLines("Étapes", List.of("Mélanger", "Cuire"), List.of("Cuire", "Mélanger"));

		assertThat(changes.list()).containsExactly(new AuditChange("Étapes (ordre)", "1. Mélanger\n2. Cuire", "1. Cuire\n2. Mélanger"));
		assertThat(new AuditChanges().addLines("Étapes", List.of("Cuire"), List.of("Cuire")).isEmpty()).isTrue();
	}

	@Test
	void shortensALongText() {
		AuditChange change = new AuditChanges().add("Texte", null, "a".repeat(2000)).list().getFirst();

		assertThat(change.after()).hasSize(AuditChanges.MAX_LENGTH).endsWith("…");
	}

	@Test
	void namesAnEnumWithoutLabel() {
		assertThat(AuditChanges.named(AuditKind.SITE_CONTENT)).isEqualTo("Site content");
	}

}
