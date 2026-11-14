package fr.lescreationsdeyona.ingredient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.nutrition.CiqualFood;
import fr.lescreationsdeyona.nutrition.CiqualFoods;
import fr.lescreationsdeyona.nutrition.NutritionFacts;
import fr.lescreationsdeyona.nutrition.NutritionLabel;
import fr.lescreationsdeyona.trash.TrashBin;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The nutrition facts of an ingredient: a Ciqual food, or the values of its label. */
class IngredientNutritionTest {

	private static final CiqualFood BUTTER = new CiqualFood(16400, "Beurre à 80% MG minimum, doux", "0901", "beurres",
			new NutritionFacts(753.04, 0.63, 0.71, 0.71, 83, 60, 0, 0.035));

	private static final CiqualFood EGG = new CiqualFood(22000, "Oeuf cru", "0410", "oeufs",
			new NutritionFacts(140, 12.8, 0.06, 0.06, 9.83, 2.64, 0, 0.31));

	private final IngredientRepository repository = mock(IngredientRepository.class);

	private final CiqualFoods ciqualFoods = mock(CiqualFoods.class);

	private final IngredientService service = new IngredientService(repository, mock(TrashBin.class), mock(AuditLog.class),
			ciqualFoods);

	private static Ingredient ingredient(long id, String name) {
		Ingredient ingredient = new Ingredient();
		ingredient.setId(id);
		ingredient.setName(name);
		return ingredient;
	}

	private static NutritionLabel label(String kcal, String sugars, String carbohydrates) {
		return new NutritionLabel(new BigDecimal(kcal), new BigDecimal("78"), new BigDecimal(carbohydrates), new BigDecimal(sugars),
				new BigDecimal("6"), new BigDecimal("4"), BigDecimal.ZERO, new BigDecimal("0.5"));
	}

	@BeforeEach
	void knowsTheTable() {
		Map<Integer, CiqualFood> table = List.of(BUTTER, EGG).stream().collect(Collectors.toMap(CiqualFood::code, Function.identity()));
		when(ciqualFoods.find(any(Integer.class))).thenAnswer(invocation -> Optional.ofNullable(table.get(invocation.<Integer>getArgument(0))));
		when(ciqualFoods.findAll(anyCollection())).thenAnswer(invocation -> invocation.<Collection<Integer>>getArgument(0)
			.stream()
			.filter(table::containsKey)
			.collect(Collectors.toMap(Function.identity(), table::get)));
		when(ciqualFoods.all()).thenReturn(List.of(BUTTER, EGG));
	}

	@Test
	void linksAnIngredientToItsCiqualFood() {
		Ingredient butter = ingredient(1, "Beurre");
		butter.setLabelKcal(new BigDecimal("700"));
		when(repository.findById(1L)).thenReturn(Optional.of(butter));

		IngredientResponse saved = service.setNutrition(1, new IngredientNutritionForm(16400, null, null));

		assertThat(butter.getCiqualCode()).isEqualTo(16400);
		assertThat(butter.getLabelKcal()).isNull();
		assertThat(saved.nutrition().ciqualName()).isEqualTo("Beurre à 80% MG minimum, doux");
		assertThat(saved.nutrition().per100g().kcal()).isEqualTo(753);
		assertThat(saved.nutrition().label()).isNull();
	}

	@Test
	void keepsTheValuesOfALabel() {
		Ingredient whey = ingredient(2, "Whey");
		whey.setCiqualCode(16400);
		when(repository.findById(2L)).thenReturn(Optional.of(whey));

		IngredientResponse saved = service.setNutrition(2,
				new IngredientNutritionForm(null, label("380", "4", "6"), " Open Food Facts · Whey · 3760000000000 "));

		assertThat(whey.getCiqualCode()).isNull();
		assertThat(whey.getLabelKcal()).isEqualByComparingTo("380");
		assertThat(whey.getLabelSource()).isEqualTo("Open Food Facts · Whey · 3760000000000");
		assertThat(saved.nutrition().ciqualCode()).isNull();
		assertThat(saved.nutrition().per100g().proteins()).isEqualTo(78);
		assertThat(saved.nutrition().labelSource()).isEqualTo("Open Food Facts · Whey · 3760000000000");
	}

	@Test
	void takesThemOff() {
		Ingredient butter = ingredient(1, "Beurre");
		butter.setCiqualCode(16400);
		when(repository.findById(1L)).thenReturn(Optional.of(butter));

		IngredientResponse saved = service.setNutrition(1, new IngredientNutritionForm(null, null, null));

		assertThat(butter.getCiqualCode()).isNull();
		assertThat(saved.nutrition()).isNull();
	}

	@Test
	void refusesWhatCannotBe() {
		when(repository.findById(1L)).thenReturn(Optional.of(ingredient(1, "Beurre")));

		assertThatThrownBy(() -> service.setNutrition(1, new IngredientNutritionForm(16400, label("380", "4", "6"), null)))
			.extracting("code").isEqualTo(ErrorCode.INGREDIENT_NUTRITION_INVALID);
		assertThatThrownBy(() -> service.setNutrition(1, new IngredientNutritionForm(99999, null, null)))
			.extracting("code").isEqualTo(ErrorCode.CIQUAL_FOOD_NOT_FOUND);
		// More sugars than carbohydrates
		assertThatThrownBy(() -> service.setNutrition(1, new IngredientNutritionForm(null, label("380", "8", "6"), null)))
			.extracting("code").isEqualTo(ErrorCode.NUTRITION_LABEL_INCONSISTENT);
	}

	@Test
	void suggestsFoodsForTheIngredientsUsedWithoutValues() {
		Ingredient eggs = ingredient(1, "Œufs");
		Ingredient butter = ingredient(2, "Beurre");
		Ingredient linked = ingredient(3, "Beurre doux");
		linked.setCiqualCode(16400);
		Ingredient unused = ingredient(4, "Oeuf de caille");
		when(repository.findAll()).thenReturn(List.of(eggs, butter, linked, unused));
		when(repository.countRecipesPerIngredient()).thenReturn(List.of(new RecipeCount(1, 2), new RecipeCount(2, 5),
				new RecipeCount(3, 9)));

		List<NutritionSuggestion> suggestions = service.nutritionSuggestions(null, 3);

		// The most used first; the one linked, and the one of no recipe, left out
		assertThat(suggestions).extracting(suggestion -> suggestion.ingredient().name()).containsExactly("Beurre", "Œufs");
		assertThat(suggestions.getFirst().foods()).extracting(CiqualFood::code).startsWith(16400);
		assertThat(suggestions.getLast().foods()).extracting(CiqualFood::code).containsExactly(22000);
		assertThat(suggestions.getFirst().ingredient().recipeCount()).isEqualTo(5);
	}

	@Test
	void linksSeveralAtOnce() {
		Ingredient eggs = ingredient(1, "Œufs");
		Ingredient butter = ingredient(2, "Beurre");
		when(repository.findAllById(any())).thenReturn(List.of(eggs, butter));

		service.linkToCiqual(List.of(new IngredientCiqualLinksForm.Link(1L, 22000), new IngredientCiqualLinksForm.Link(2L, 16400)));

		assertThat(eggs.getCiqualCode()).isEqualTo(22000);
		assertThat(butter.getCiqualCode()).isEqualTo(16400);
		assertThatThrownBy(() -> service.linkToCiqual(List.of(new IngredientCiqualLinksForm.Link(1L, 99999),
				new IngredientCiqualLinksForm.Link(2L, 16400)))).extracting("code").isEqualTo(ErrorCode.CIQUAL_FOOD_NOT_FOUND);
	}

	@Test
	void takesTheValuesOffSeveralAtOnce() {
		Ingredient eggs = ingredient(1, "Œufs");
		eggs.setCiqualCode(22000);
		Ingredient whey = ingredient(2, "Whey");
		whey.setLabelKcal(new BigDecimal("380"));
		whey.setLabelSource("Open Food Facts · Whey");
		Ingredient flour = ingredient(3, "Farine");
		when(repository.findAllById(any())).thenReturn(List.of(eggs, whey, flour));

		service.removeNutrition(List.of(1L, 2L, 3L));

		assertThat(eggs.getCiqualCode()).isNull();
		assertThat(whey.getLabelKcal()).isNull();
		assertThat(whey.getLabelSource()).isNull();
		// One unknown: nothing is taken off
		when(repository.findAllById(any())).thenReturn(List.of(eggs));
		assertThatThrownBy(() -> service.removeNutrition(List.of(1L, 99L))).extracting("code").isEqualTo(ErrorCode.INGREDIENT_NOT_FOUND);
	}

	@Test
	void keepsTheShareEatenAndOffersTheUsualOne() {
		Ingredient chicken = ingredient(1, "Poulet fermier");
		when(repository.findById(1L)).thenReturn(Optional.of(chicken));
		assertThat(chicken.getEdiblePercent()).isEqualTo(100);

		IngredientResponse saved = service.setEdiblePart(1, 70);

		assertThat(chicken.getEdiblePercent()).isEqualTo(70);
		assertThat(saved.ediblePercent()).isEqualTo(70);
		// The usual weight of a chicken, and the share of it usually eaten, offered whatever was typed
		assertThat(saved.usual()).isEqualTo(new IngredientUsual(new IngredientPiece(new BigDecimal("1500"), "poulet", "poulets"), 68));
	}

}
