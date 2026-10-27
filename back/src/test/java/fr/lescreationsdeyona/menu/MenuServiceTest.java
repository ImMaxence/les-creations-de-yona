package fr.lescreationsdeyona.menu;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuResponses.MenuRecipe;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeMapper;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MenuServiceTest {

	private final MenuRepository menuRepository = mock(MenuRepository.class);

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final MenuService service = new MenuService(menuRepository, recipeRepository, mock(RecipeMapper.class));

	private static Recipe recipe(long id, String title, RecipeStatus status) {
		Recipe recipe = new Recipe();
		recipe.setId(id);
		recipe.setTitle(title);
		recipe.setStatus(status);
		return recipe;
	}

	private static Menu menu(long id, String title, boolean published, Recipe... recipes) {
		Menu menu = new Menu();
		menu.setId(id);
		menu.setTitle(title);
		menu.setSlug(title.toLowerCase().replace(' ', '-'));
		menu.setPublished(published);
		menu.getRecipes().addAll(List.of(recipes));
		return menu;
	}

	@Test
	void keepsTheRecipesInTheOrderGivenEachOnce() {
		Recipe soup = recipe(1, "Velouté", RecipeStatus.PUBLISHED);
		Recipe tart = recipe(2, "Tarte", RecipeStatus.DRAFT);
		when(menuRepository.findByTitle(anyString())).thenReturn(Optional.empty());
		when(recipeRepository.findAllById(any())).thenReturn(List.of(soup, tart));
		when(menuRepository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));

		AdminMenu menu = service.create(new MenuForm("  menu d'automne ", "", true, List.of(2L, 1L, 2L)));

		assertThat(menu.title()).isEqualTo("Menu d'automne");
		assertThat(menu.slug()).isEqualTo("menu-d-automne");
		assertThat(menu.intro()).isNull();
		assertThat(menu.recipes()).extracting(MenuRecipe::title).containsExactly("Tarte", "Velouté");
	}

	@Test
	void refusesATitleAlreadyTaken() {
		when(menuRepository.findByTitle("Menu de Noël")).thenReturn(Optional.of(menu(7, "Menu de Noël", true)));

		assertThatThrownBy(() -> service.create(new MenuForm("Menu de Noël", null, true, List.of(1L))))
			.isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.MENU_ALREADY_EXISTS);
	}

	@Test
	void keepsItsOwnTitleOnUpdate() {
		Menu christmas = menu(7, "Menu de Noël", false);
		when(menuRepository.findById(7L)).thenReturn(Optional.of(christmas));
		when(menuRepository.findByTitle("Menu de noël")).thenReturn(Optional.of(christmas));
		when(recipeRepository.findAllById(any())).thenReturn(List.of(recipe(1, "Bûche", RecipeStatus.PUBLISHED)));
		when(menuRepository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));

		assertThat(service.update(7, new MenuForm("Menu de noël", null, true, List.of(1L))).published()).isTrue();
	}

	@Test
	void refusesARecipeThatNoLongerExists() {
		when(menuRepository.findByTitle(anyString())).thenReturn(Optional.empty());
		when(recipeRepository.findAllById(any())).thenReturn(List.of());

		assertThatThrownBy(() -> service.create(new MenuForm("Goûter", null, true, List.of(9L))))
			.isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.MENU_RECIPE_NOT_FOUND);
	}

	@Test
	void showsOnTheSiteThePublishedRecipesOnly() {
		Menu autumn = menu(1, "Automne", true, recipe(1, "Velouté", RecipeStatus.DRAFT),
				recipe(2, "Tarte", RecipeStatus.PUBLISHED));
		Menu drafts = menu(2, "Brouillons", true, recipe(3, "Bûche", RecipeStatus.DRAFT));
		when(menuRepository.findByPublishedTrueOrderByUpdatedAtDesc()).thenReturn(List.of(autumn, drafts));

		List<MenuSummary> menus = service.listPublished();

		assertThat(menus).extracting(MenuSummary::title).containsExactly("Automne");
		assertThat(menus.getFirst().recipeCount()).isEqualTo(1);
	}

	@Test
	void hidesAMenuWithoutPublishedRecipe() {
		when(menuRepository.findBySlugAndPublishedTrue("brouillons"))
			.thenReturn(Optional.of(menu(2, "Brouillons", true, recipe(3, "Bûche", RecipeStatus.DRAFT))));

		assertThatThrownBy(() -> service.getPublished("brouillons")).isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.MENU_NOT_FOUND);
	}

}
