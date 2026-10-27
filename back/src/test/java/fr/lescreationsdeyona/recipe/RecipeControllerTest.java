package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.search.SearchMissService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class RecipeControllerTest {

	private static final ValidatorFactory VALIDATION = Validation.buildDefaultValidatorFactory();

	private final RecipeService recipeService = mock(RecipeService.class);

	private final SearchMissService searchMissService = mock(SearchMissService.class);

	private final RecipeController controller = new RecipeController(recipeService, searchMissService);

	private final Pageable firstPage = PageRequest.of(0, 12);

	@AfterAll
	static void closeValidation() {
		VALIDATION.close();
	}

	@Test
	void searchesWithEveryIngredientGiven() {
		when(recipeService.searchPublished(any(), any())).thenReturn(Page.empty(firstPage));

		controller.listPublishedRecipes(null, "desserts", null, List.of("Œufs", "Chocolat"), 30, DifficultyLevel.EASY,
				firstPage);

		RecipeFilter filter = searchedFilter();
		assertThat(filter.ingredientNames()).containsExactly("Œufs", "Chocolat");
		assertThat(filter.categorySlug()).isEqualTo("desserts");
		assertThat(filter.maxMinutes()).isEqualTo(30);
		assertThat(filter.difficulty()).isEqualTo(DifficultyLevel.EASY);
	}

	@Test
	void searchesWithoutIngredientWhenNoneIsGiven() {
		when(recipeService.searchPublished(any(), any())).thenReturn(Page.empty(firstPage));

		controller.listPublishedRecipes(null, null, null, null, null, null, firstPage);

		assertThat(searchedFilter().ingredientNames()).isEmpty();
	}

	@Test
	void notesATitleSearchThatFindsNothing() {
		when(recipeService.searchPublished(any(), any())).thenReturn(Page.empty(firstPage));

		controller.listPublishedRecipes("tarte tatin", null, null, null, null, null, firstPage);

		verify(searchMissService).record("tarte tatin");
	}

	@Test
	void doesNotNoteAnEmptyPagePastTheFirst() {
		Pageable secondPage = PageRequest.of(1, 12);
		when(recipeService.searchPublished(any(), any())).thenReturn(Page.empty(secondPage));

		controller.listPublishedRecipes("tarte tatin", null, null, null, null, null, secondPage);

		verify(searchMissService, never()).record(anyString());
	}

	@Test
	void acceptsUpToFiveIngredients() throws NoSuchMethodException {
		assertThat(violations(List.of("Œufs", "Lait", "Sucre", "Farine", "Beurre"))).isEmpty();
	}

	@Test
	void refusesMoreThanFiveIngredientsOrAnIngredientTooLong() throws NoSuchMethodException {
		assertThat(violations(List.of("Œufs", "Lait", "Sucre", "Farine", "Beurre", "Sel"))).hasSize(1);
		assertThat(violations(List.of("a".repeat(101)))).hasSize(1);
	}

	@Test
	void copiesTheIngredientsOfAFilter() {
		List<String> names = new ArrayList<>(List.of("Œufs"));
		RecipeFilter filter = new RecipeFilter(null, null, null, names, null, null, null, null, null);
		names.add("Chocolat");
		assertThat(filter.ingredientNames()).containsExactly("Œufs");
		assertThat(RecipeFilter.publishedTitled("tarte").ingredientNames()).isEmpty();
	}

	private RecipeFilter searchedFilter() {
		ArgumentCaptor<RecipeFilter> filter = ArgumentCaptor.forClass(RecipeFilter.class);
		verify(recipeService).searchPublished(filter.capture(), any());
		return filter.getValue();
	}

	/** The constraints Spring checks on the request parameters, without starting Spring. */
	private Set<ConstraintViolation<RecipeController>> violations(List<String> ingredients)
			throws NoSuchMethodException {
		Method list = RecipeController.class.getDeclaredMethod("listPublishedRecipes", String.class, String.class,
				String.class, List.class, Integer.class, DifficultyLevel.class, Pageable.class);
		Object[] arguments = { null, null, null, ingredients, null, null, firstPage };
		return VALIDATION.getValidator().forExecutables().validateParameters(controller, list, arguments);
	}

}
