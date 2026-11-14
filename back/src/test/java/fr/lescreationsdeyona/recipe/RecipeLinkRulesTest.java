package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.nutrition.NutritionService;
import fr.lescreationsdeyona.shop.ShopProductRepository;
import fr.lescreationsdeyona.tag.TagService;
import fr.lescreationsdeyona.trash.TrashBin;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

/** What keeps recipes used as parts of others whole: publication, loops, depth, deletion. */
class RecipeLinkRulesTest {

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final CategoryRepository categoryRepository = mock(CategoryRepository.class);

	private final IngredientService ingredientService = mock(IngredientService.class);

	private final RecipeMapper recipeMapper = mock(RecipeMapper.class);

	private final ShopProductRepository shopProducts = mock(ShopProductRepository.class);

	private final RecipeService service = new RecipeService(recipeRepository, categoryRepository, ingredientService,
			mock(ImageService.class), mock(TagService.class), mock(MenuService.class), mock(TrashBin.class), recipeMapper,
			mock(ApplicationEventPublisher.class), mock(AuditLog.class), shopProducts, mock(NutritionService.class));

	private final Category desserts = new Category();

	@BeforeEach
	void savesAsGiven() {
		desserts.setId(1L);
		desserts.setSlug("desserts");
		when(recipeRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
		when(recipeMapper.toDetail(any())).thenReturn(new RecipeDetail(1L, "Tarte", "tarte", null, RecipeStatus.DRAFT, RecipeTheme.SWEET,
				false, null, null, List.of(), List.of(), null, null, null, null, null, null, null, List.of(), List.of(), null, null, null,
				List.of(), Instant.EPOCH, Instant.EPOCH, null, null, null));
		when(categoryRepository.findAllById(any())).thenReturn(List.of(desserts));
		Ingredient flour = new Ingredient();
		flour.setId(5L);
		when(ingredientService.findOrCreate(anyString())).thenReturn(flour);
	}

	private Recipe recipe(long id, RecipeStatus status) {
		Recipe recipe = new Recipe();
		recipe.setId(id);
		recipe.setTitle("Recette " + id);
		recipe.setSlug("recette-" + id);
		recipe.setStatus(status);
		recipe.getCategories().add(desserts);
		when(recipeRepository.findById(id)).thenReturn(Optional.of(recipe));
		return recipe;
	}

	private static void link(Recipe recipe, Recipe linked) {
		RecipePart part = new RecipePart();
		part.setRecipe(recipe);
		part.setLinkedRecipe(linked);
		part.setLinkedRatio(BigDecimal.ONE);
		recipe.getParts().add(part);
	}

	private static RecipeForm formLinking(long linkedId, RecipeStatus status) {
		return new RecipeForm("Tarte", null, status, RecipeTheme.SWEET, false, null, List.of(1L), null, null, null, null, null, null, null,
				null, null, null, null, null,
				List.of(new RecipeForm.Part("Pâte", List.of(), List.of(), linkedId, new BigDecimal("0.5"))));
	}

	private static RecipeForm plainForm(RecipeStatus status) {
		return new RecipeForm("Tarte", null, status, RecipeTheme.SWEET, false, null, List.of(1L), null, null, null, null, null, null, null,
				null, null, null, null, null, List.of(new RecipeForm.Part(null,
						List.of(new RecipeForm.IngredientLine("Farine", null, null, null)),
						List.of(new RecipeForm.Step("Mélanger", null, List.of())))));
	}

	@Test
	void savesAPartLinkedToAnotherRecipeWithoutContentOfItsOwn() {
		recipe(2, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.DRAFT);

		service.update(3, formLinking(2, RecipeStatus.PUBLISHED));

		RecipePart part = tart.getParts().getFirst();
		assertThat(part.getLinkedRecipe().getId()).isEqualTo(2);
		assertThat(part.getLinkedRatio()).isEqualByComparingTo("0.5");
		assertThat(part.getIngredients()).isEmpty();
	}

	@Test
	void takesTheTitleOfTheLinkedRecipeWhenNoneIsGiven() {
		Recipe dough = recipe(2, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.DRAFT);

		service.update(3, new RecipeForm("Tarte", null, RecipeStatus.DRAFT, RecipeTheme.SWEET, false, null, List.of(1L), null, null, null, null,
				null, null, null, null, null, null, null, null, List.of(new RecipeForm.Part(" ", List.of(), List.of(), 2L, null))));

		assertThat(tart.getParts().getFirst().getTitle()).isEqualTo(dough.getTitle());
		assertThat(tart.getParts().getFirst().getLinkedRatio()).isEqualByComparingTo("1");
	}

	@Test
	void refusesContentOnALinkedPart() {
		recipe(2, RecipeStatus.PUBLISHED);
		recipe(3, RecipeStatus.DRAFT);
		RecipeForm form = new RecipeForm("Tarte", null, RecipeStatus.DRAFT, RecipeTheme.SWEET, false, null, List.of(1L), null, null, null, null,
				null, null, null, null, null, null, null, null, List.of(new RecipeForm.Part("Pâte",
						List.of(new RecipeForm.IngredientLine("Farine", null, null, null)), List.of(), 2L, null)));

		assertThatThrownBy(() -> service.update(3, form)).extracting("code").isEqualTo(ErrorCode.RECIPE_LINK_WITH_CONTENT);
	}

	@Test
	void refusesToPublishARecipeUsingADraft() {
		recipe(2, RecipeStatus.DRAFT);
		recipe(3, RecipeStatus.DRAFT);

		assertThatThrownBy(() -> service.update(3, formLinking(2, RecipeStatus.PUBLISHED)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINK_NOT_PUBLISHED);
	}

	@Test
	void letsADraftUseADraft() {
		recipe(2, RecipeStatus.DRAFT);
		Recipe tart = recipe(3, RecipeStatus.DRAFT);

		service.update(3, formLinking(2, RecipeStatus.DRAFT));

		assertThat(tart.getParts()).hasSize(1);
	}

	@Test
	void refusesToUnpublishARecipeAPublishedOneUses() {
		Recipe dough = recipe(2, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.PUBLISHED);
		when(recipeRepository.findRecipesLinking(2)).thenReturn(List.of(tart));

		assertThatThrownBy(() -> service.update(dough.getId(), plainForm(RecipeStatus.DRAFT)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINKED_IN_USE);
	}

	@Test
	void refusesARecipeUsingItself() {
		recipe(3, RecipeStatus.PUBLISHED);

		assertThatThrownBy(() -> service.update(3, formLinking(3, RecipeStatus.PUBLISHED)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINK_CYCLE);
	}

	@Test
	void refusesALoopThroughAnotherRecipe() {
		Recipe tart = recipe(3, RecipeStatus.PUBLISHED);
		Recipe dough = recipe(2, RecipeStatus.PUBLISHED);
		link(dough, tart);

		assertThatThrownBy(() -> service.update(3, formLinking(2, RecipeStatus.PUBLISHED)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINK_CYCLE);
	}

	@Test
	void refusesAFourthLevelBelow() {
		Recipe base = recipe(1, RecipeStatus.PUBLISHED);
		Recipe cream = recipe(2, RecipeStatus.PUBLISHED);
		Recipe filling = recipe(4, RecipeStatus.PUBLISHED);
		link(cream, base);
		link(filling, cream);
		recipe(3, RecipeStatus.PUBLISHED);

		assertThatThrownBy(() -> service.update(3, formLinking(4, RecipeStatus.PUBLISHED)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINK_TOO_DEEP);
	}

	@Test
	void refusesAFourthLevelAbove() {
		Recipe top = recipe(5, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.PUBLISHED);
		Recipe cream = recipe(2, RecipeStatus.PUBLISHED);
		Recipe base = recipe(1, RecipeStatus.PUBLISHED);
		link(cream, base);
		link(top, tart);
		when(recipeRepository.findRecipesLinking(3)).thenReturn(List.of(top));

		assertThatThrownBy(() -> service.update(3, formLinking(2, RecipeStatus.PUBLISHED)))
			.extracting("code")
			.isEqualTo(ErrorCode.RECIPE_LINK_TOO_DEEP);
	}

	@Test
	void refusesToDeleteARecipeAnotherUses() {
		Recipe dough = recipe(2, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.PUBLISHED);
		when(recipeRepository.findRecipesLinking(2)).thenReturn(List.of(tart));

		assertThatThrownBy(() -> service.delete(2)).extracting("code").isEqualTo(ErrorCode.RECIPE_LINKED_IN_USE);
		verify(recipeRepository, never()).deleteAll(List.of(dough));
	}

	@Test
	void deletesARecipeTogetherWithTheOneUsingIt() {
		Recipe dough = recipe(2, RecipeStatus.PUBLISHED);
		Recipe tart = recipe(3, RecipeStatus.PUBLISHED);
		when(recipeRepository.findAllById(List.of(2L, 3L))).thenReturn(List.of(dough, tart));
		when(recipeRepository.findRecipesLinking(2)).thenReturn(List.of(tart));

		service.deleteAll(List.of(2L, 3L));

		verify(recipeRepository).deleteAll(List.of(dough, tart));
	}

	@Test
	void refusesToDeleteARecipeOfTheShop() {
		recipe(2, RecipeStatus.PUBLISHED);
		when(shopProducts.findTitlesOfRecipes(any())).thenReturn(List.of("Recette 2"));

		assertThatThrownBy(() -> service.delete(2)).extracting("code").isEqualTo(ErrorCode.RECIPE_IN_SHOP);
	}

	@Test
	void doesNotPublishNowARecipeUsingADraft() {
		Recipe tart = recipe(3, RecipeStatus.DRAFT);
		link(tart, recipe(2, RecipeStatus.DRAFT));

		assertThatThrownBy(() -> service.publishNow(3)).extracting("code").isEqualTo(ErrorCode.RECIPE_LINK_NOT_PUBLISHED);
		assertThat(tart.getStatus()).isEqualTo(RecipeStatus.DRAFT);
	}

}
