package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.audit.AuditChanges;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class RecipeChangesTest {

	@Test
	void saysWhatTheEditorChanged() {
		RecipeDetail before = recipe("Tarte", 20, List.of(new RecipeDetail.IngredientLine("Farine", new BigDecimal("200"), "g", null)),
				List.of(new RecipeDetail.Step("Mélanger", null, List.of()), new RecipeDetail.Step("Cuire", 30, List.of())));
		RecipeDetail after = recipe("Tarte fine", 90,
				List.of(new RecipeDetail.IngredientLine("Farine", new BigDecimal("250.00"), "g", "tamisée")),
				List.of(new RecipeDetail.Step("Mélanger", null, List.of()), new RecipeDetail.Step("Cuire", 35, List.of())));

		AuditChanges changes = RecipeChanges.between(before, after);

		assertThat(changes).usingRecursiveComparison()
			.isEqualTo(new AuditChanges().add("Titre", "Tarte", "Tarte fine")
				.add("Préparation", "20 min", "1 h 30")
				.addLines("Ingrédients", List.of("200 g Farine"), List.of("250 g Farine (tamisée)"))
				.addLines("Étapes", List.of("Cuire (30 min)"), List.of("Cuire (35 min)")));
	}

	@Test
	void findsNothingInARecipeSavedAsItWas() {
		RecipeDetail recipe = recipe("Tarte", 20, List.of(), List.of(new RecipeDetail.Step("Cuire", null, List.of())));

		assertThat(RecipeChanges.between(recipe, recipe).isEmpty()).isTrue();
	}

	@Test
	void listsTheQuestionsChanged() {
		RecipeDetail before = recipe("Tarte", List.of(new RecipeQuestion("Peut-on la congeler ?", "Oui, 2 mois")));
		RecipeDetail after = recipe("Tarte", List.of(new RecipeQuestion("Peut-on la congeler ?", "Oui, 3 mois"),
				new RecipeQuestion("Sans gluten ?", "Avec une farine de riz")));

		assertThat(RecipeChanges.between(before, after)).usingRecursiveComparison()
			.isEqualTo(new AuditChanges().addLines("Questions fréquentes", List.of("Peut-on la congeler ? Oui, 2 mois"),
					List.of("Peut-on la congeler ? Oui, 3 mois", "Sans gluten ? Avec une farine de riz")));
	}

	private static RecipeDetail recipe(String title, List<RecipeQuestion> questions) {
		return recipe(title, 20, List.of(), List.of(new RecipeDetail.Step("Cuire", null, List.of())), questions);
	}

	private static RecipeDetail recipe(String title, Integer prepMinutes, List<RecipeDetail.IngredientLine> ingredients,
			List<RecipeDetail.Step> steps) {
		return recipe(title, prepMinutes, ingredients, steps, List.of());
	}

	private static RecipeDetail recipe(String title, Integer prepMinutes, List<RecipeDetail.IngredientLine> ingredients,
			List<RecipeDetail.Step> steps, List<RecipeQuestion> questions) {
		return new RecipeDetail(1L, title, "tarte", null, RecipeStatus.PUBLISHED, RecipeTheme.SWEET, false, null, List.of(),
				List.of(), 6, prepMinutes, null, null, null, null, null, List.of(), questions, null, null, null,
				List.of(new RecipeDetail.Part(null, ingredients, steps)), Instant.EPOCH, Instant.EPOCH, null, null);
	}

}
