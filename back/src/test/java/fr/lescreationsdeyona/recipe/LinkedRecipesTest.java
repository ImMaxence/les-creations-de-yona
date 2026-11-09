package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.ingredient.Ingredient;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** "Pâte sablée" used in a tart: unfolded for the site into plain parts. */
class LinkedRecipesTest {

	private final RecipeMapper mapper = mock(RecipeMapper.class);

	private long nextId = 1;

	@BeforeEach
	void mapsPartsAsTheyAre() {
		when(mapper.toPart(any())).thenAnswer(invocation -> {
			RecipePart part = invocation.getArgument(0);
			return new RecipeDetail.Part(part.getTitle(),
					part.getIngredients().stream()
						.map(line -> new RecipeDetail.IngredientLine(line.getIngredient().getName(), line.getQuantity(), line.getUnit(), null))
						.toList(),
					List.of(new RecipeDetail.Step("Étape", null, List.of())));
		});
	}

	private Recipe recipe(String title) {
		Category category = new Category();
		category.setSlug("bases");
		Recipe recipe = new Recipe();
		recipe.setId(nextId++);
		recipe.setTitle(title);
		recipe.setSlug(title.toLowerCase().replace(' ', '-'));
		recipe.setStatus(RecipeStatus.PUBLISHED);
		recipe.getCategories().add(category);
		return recipe;
	}

	private static RecipePart addPart(Recipe recipe, String title, String ingredientName, String quantity) {
		RecipePart part = new RecipePart();
		part.setRecipe(recipe);
		part.setTitle(title);
		Ingredient ingredient = new Ingredient();
		ingredient.setName(ingredientName);
		RecipeIngredient line = new RecipeIngredient();
		line.setPart(part);
		line.setIngredient(ingredient);
		line.setQuantity(new BigDecimal(quantity));
		line.setUnit("g");
		part.getIngredients().add(line);
		recipe.getParts().add(part);
		return part;
	}

	private static void link(Recipe recipe, String title, Recipe linked, String ratio) {
		RecipePart part = new RecipePart();
		part.setRecipe(recipe);
		part.setTitle(title);
		part.setLinkedRecipe(linked);
		part.setLinkedRatio(new BigDecimal(ratio));
		recipe.getParts().add(part);
	}

	private RecipeDetail unfold(Recipe recipe) {
		return LinkedRecipes.unfold(recipe, detailOf(recipe), mapper);
	}

	private static RecipeDetail detailOf(Recipe recipe) {
		List<String> equipment = recipe.getEquipment() == null ? List.of() : recipe.getEquipment().lines().toList();
		return new RecipeDetail(recipe.getId(), recipe.getTitle(), recipe.getSlug(), null, RecipeStatus.PUBLISHED, RecipeTheme.SWEET,
				false, null, List.of(), List.of(), null, null, null, null, null, null, null, equipment, List.of(), null, null, null,
				List.of(), Instant.EPOCH, Instant.EPOCH, null, null);
	}

	@Test
	void leavesARecipeWithoutLinksUntouched() {
		Recipe tart = recipe("Tarte");
		addPart(tart, null, "Citron", "100");
		RecipeDetail detail = detailOf(tart);

		assertThat(LinkedRecipes.unfold(tart, detail, mapper)).isSameAs(detail);
	}

	@Test
	void multipliesTheQuantitiesOfTheLinkedRecipe() {
		Recipe dough = recipe("Pâte sablée");
		addPart(dough, null, "Farine", "250");
		Recipe tart = recipe("Tarte");
		link(tart, "Pâte", dough, "0.5");
		addPart(tart, "Crème", "Citron", "100");

		RecipeDetail unfolded = unfold(tart);

		assertThat(unfolded.parts()).hasSize(2);
		RecipeDetail.Part first = unfolded.parts().getFirst();
		assertThat(first.title()).isEqualTo("Pâte");
		assertThat(first.ingredients().getFirst().quantity()).isEqualByComparingTo("125");
		assertThat(first.linkedRecipe().slug()).isEqualTo("pâte-sablée");
		assertThat(first.linkedRecipe().ratio()).isEqualByComparingTo("0.5");
		assertThat(unfolded.parts().get(1).ingredients().getFirst().quantity()).isEqualByComparingTo("100");
		assertThat(unfolded.parts().get(1).linkedRecipe()).isNull();
	}

	@Test
	void titlesEachPartOfALinkedRecipeInParts() {
		Recipe dough = recipe("Feuilletage");
		addPart(dough, "Détrempe", "Farine", "250");
		addPart(dough, "Beurrage", "Beurre", "200");
		Recipe tart = recipe("Tarte");
		link(tart, "Feuilletage", dough, "1");

		assertThat(unfold(tart).parts()).extracting(RecipeDetail.Part::title)
			.containsExactly("Feuilletage · Détrempe", "Feuilletage · Beurrage");
	}

	@Test
	void multipliesRatiosThroughSeveralLevels() {
		Recipe custard = recipe("Crème pâtissière");
		addPart(custard, null, "Lait", "500");
		Recipe cream = recipe("Crème diplomate");
		link(cream, "Crème pâtissière", custard, "2");
		Recipe tart = recipe("Tarte");
		link(tart, "Crème diplomate", cream, "0.5");

		RecipeDetail.Part part = unfold(tart).parts().getFirst();

		assertThat(part.ingredients().getFirst().quantity()).isEqualByComparingTo("500");
		assertThat(part.title()).isEqualTo("Crème diplomate · Crème pâtissière");
		// The recipe named is the one the admin chose in this tart
		assertThat(part.linkedRecipe().title()).isEqualTo("Crème diplomate");
	}

	@Test
	void addsTheEquipmentOfTheLinkedRecipeOnce() {
		Recipe dough = recipe("Pâte");
		dough.setEquipment("Rouleau\nFouet");
		addPart(dough, null, "Farine", "250");
		Recipe tart = recipe("Tarte");
		tart.setEquipment("Fouet\nMoule");
		link(tart, "Pâte", dough, "1");

		assertThat(unfold(tart).equipment()).containsExactly("Fouet", "Moule", "Rouleau");
	}

	@Test
	void endsOnFaultyDataLoopingOnItself() {
		Recipe first = recipe("Une");
		Recipe second = recipe("Deux");
		link(first, "Deux", second, "1");
		link(second, "Une", first, "1");
		addPart(second, "Fin", "Sel", "1");

		assertThat(unfold(first).parts()).extracting(RecipeDetail.Part::title).containsExactly("Deux · Fin");
	}

	@Test
	void countsTheLevelsBelowARecipe() {
		Recipe custard = recipe("Crème pâtissière");
		addPart(custard, null, "Lait", "500");
		Recipe cream = recipe("Crème diplomate");
		link(cream, "Crème pâtissière", custard, "1");

		assertThat(LinkedRecipes.levelsBelow(custard)).isEqualTo(1);
		assertThat(LinkedRecipes.levelsBelow(cream)).isEqualTo(2);
	}

	@Test
	void findsWhatARecipeReaches() {
		Recipe custard = recipe("Crème pâtissière");
		Recipe cream = recipe("Crème diplomate");
		link(cream, "Crème pâtissière", custard, "1");

		assertThat(LinkedRecipes.reaches(cream, custard.getId())).isTrue();
		assertThat(LinkedRecipes.reaches(custard, cream.getId())).isFalse();
	}

}
