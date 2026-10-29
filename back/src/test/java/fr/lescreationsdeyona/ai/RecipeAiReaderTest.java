package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.recipe.MoldShape;
import fr.lescreationsdeyona.recipe.RecipeForm;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class RecipeAiReaderTest {

	private final JsonMapper json = JsonMapper.builder().build();

	private final RecipeAiReader.Known known = new RecipeAiReader.Known(Map.of("Desserts", 1L, "Crêpes et gaufres", 2L),
			Map.of("Végétarien", 7L), List.of("Œufs", "Farine T45", "Lait entier"));

	private RecipeAiDraft read(String answer) {
		return RecipeAiReader.read(json.readTree(answer), known);
	}

	@Test
	void fillsTheDraftWithTheSitesOwnNames() {
		RecipeAiDraft draft = read("""
				{"isRecipe":true,"theme":"SWEET","title":"  Crêpes  ","intro":null,"servings":4,"prepMinutes":10,"cookMinutes":20,
				"restMinutes":60,"difficulty":1.3,"categories":["crepes et gaufres","Plats"],"tags":["vegetarien"],
				"parts":[{"title":"Les crêpes","ingredients":[
				  {"name":"oeufs","quantity":4,"unit":null,"note":null},
				  {"name":"Farine T45","quantity":250,"unit":"g","note":null},
				  {"name":"Sucre vanillé","quantity":0.333,"unit":"sachet","note":null}],
				 "steps":[{"description":"Mélangez la farine et les œufs","durationMinutes":null,"ingredientPositions":[1,0,9]}]}],
				"equipment":["poêle à crêpes","Poêle à crêpes"],"mold":null,"tip":"Se garde 2 jours"}""");

		assertThat(draft.title()).isEqualTo("Crêpes");
		assertThat(draft.theme()).isEqualTo(RecipeTheme.SWEET);
		assertThat(draft.difficulty()).isEqualByComparingTo("1.5");
		assertThat(draft.categoryIds()).containsExactly(2L);
		assertThat(draft.tagIds()).containsExactly(7L);
		assertThat(draft.equipment()).containsExactly("Poêle à crêpes");
		RecipeForm.Part part = draft.parts().getFirst();
		// A single part: no title, the recipe's is enough
		assertThat(part.title()).isNull();
		assertThat(part.ingredients()).extracting(RecipeForm.IngredientLine::name)
			.containsExactly("Œufs", "Farine T45", "Sucre vanillé");
		assertThat(part.ingredients().get(1).quantity()).isEqualTo(new BigDecimal("250"));
		assertThat(part.ingredients().get(2).quantity()).isEqualTo(new BigDecimal("0.33"));
		assertThat(part.steps().getFirst().ingredientPositions()).containsExactly(1, 0);
	}

	@Test
	void keepsAnIngredientOncePerPartAndItsStepsPointingAtIt() {
		RecipeAiDraft draft = read("""
				{"isRecipe":true,"parts":[
				 {"title":"La pâte","ingredients":[{"name":"Beurre","quantity":100,"unit":"g"},{"name":"beurre","quantity":20,"unit":"g"},
				  {"name":" ","quantity":1},{"name":"Sucre","quantity":50,"unit":"g"}],
				  "steps":[{"description":"Sablez","ingredientPositions":[1,3]},{"description":"  "}]},
				 {"title":"La crème","ingredients":[{"name":"Beurre","quantity":50,"unit":"g"}],"steps":[]},
				 {"title":"Vide","ingredients":[],"steps":[]}]}""");

		assertThat(draft.parts()).extracting(RecipeForm.Part::title).containsExactly("La pâte", "La crème");
		RecipeForm.Part dough = draft.parts().getFirst();
		assertThat(dough.ingredients()).extracting(RecipeForm.IngredientLine::name).containsExactly("Beurre", "Sucre");
		assertThat(dough.steps()).singleElement().extracting(RecipeForm.Step::ingredientPositions).isEqualTo(List.of(0, 1));
	}

	@Test
	void leavesOutWhatDoesNotFitTheForm() {
		RecipeAiDraft draft = read("""
				{"isRecipe":true,"servings":0,"prepMinutes":-5,"cookMinutes":"20","difficulty":9,"categories":[3],
				"mold":{"shape":"RECTANGLE","lengthCm":30,"widthCm":null},
				"parts":[{"ingredients":[{"name":"Sel","quantity":-1,"unit":"une pincée de sel fin de Guérande bien sec"}],
				"steps":[{"description":"Salez","durationMinutes":0}]}]}""");

		assertThat(draft.servings()).isNull();
		assertThat(draft.prepMinutes()).isNull();
		assertThat(draft.cookMinutes()).isNull();
		assertThat(draft.difficulty()).isEqualByComparingTo("5.0");
		assertThat(draft.categoryIds()).isEmpty();
		// A rectangle needs both sides
		assertThat(draft.mold()).isNull();
		RecipeForm.IngredientLine salt = draft.parts().getFirst().ingredients().getFirst();
		assertThat(salt.quantity()).isNull();
		assertThat(salt.unit()).hasSizeLessThanOrEqualTo(30);
		assertThat(draft.parts().getFirst().steps().getFirst().durationMinutes()).isNull();
	}

	@Test
	void readsARoundMold() {
		RecipeAiDraft draft = read("""
				{"isRecipe":true,"mold":{"shape":"ROUND","lengthCm":24,"widthCm":10},
				"parts":[{"ingredients":[],"steps":[{"description":"Beurrez le moule"}]}]}""");

		assertThat(draft.mold()).isEqualTo(new RecipeForm.Mold(MoldShape.ROUND, new BigDecimal("24.0"), null));
	}

	@Test
	void findsNoRecipeWhenThereIsNone() {
		assertThat(read("{\"isRecipe\":false,\"parts\":[]}")).isNull();
		assertThat(read("{\"isRecipe\":true,\"title\":\"Facture\",\"parts\":[{\"ingredients\":[],\"steps\":[]}]}")).isNull();
	}

}
