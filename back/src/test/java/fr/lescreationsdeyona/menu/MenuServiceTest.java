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
import fr.lescreationsdeyona.recipe.RecipeLinks.MenuPlace;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MenuServiceTest {

	private final MenuRepository menuRepository = mock(MenuRepository.class);

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final TrashBin trashBin = mock(TrashBin.class);

	private final MenuService service = new MenuService(menuRepository, recipeRepository, mock(RecipeMapper.class),
			trashBin);

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

	@Test
	void putsARestoredRecipeBackAtItsPlace() {
		Recipe tart = recipe(2, "Tarte", RecipeStatus.PUBLISHED);
		Menu autumn = menu(1, "Automne", true, recipe(1, "Velouté", RecipeStatus.PUBLISHED),
				recipe(3, "Bûche", RecipeStatus.PUBLISHED));
		when(recipeRepository.getReferenceById(2L)).thenReturn(tart);
		when(menuRepository.findById(1L)).thenReturn(Optional.of(autumn));
		when(menuRepository.findById(5L)).thenReturn(Optional.empty());

		int added = service.addBack(2, List.of(new MenuPlace(1L, 1), new MenuPlace(5L, 0)));

		assertThat(added).isEqualTo(1);
		assertThat(autumn.getRecipes()).extracting(Recipe::getTitle).containsExactly("Velouté", "Tarte", "Bûche");
	}

	@Test
	void leavesAFullMenuAsItIs() {
		Menu full = menu(1, "Buffet", true);
		for (long id = 10; id < 22; id++) {
			full.getRecipes().add(recipe(id, "Recette " + id, RecipeStatus.PUBLISHED));
		}
		when(recipeRepository.getReferenceById(2L)).thenReturn(recipe(2, "Tarte", RecipeStatus.PUBLISHED));
		when(menuRepository.findById(1L)).thenReturn(Optional.of(full));

		assertThat(service.addBack(2, List.of(new MenuPlace(1L, 0)))).isZero();
		assertThat(full.getRecipes()).hasSize(12);
	}

	@Test
	void restoresAMenuWithItsRecipesFoundByIdOrByAddress() {
		TrashItem trashed = new TrashItem();
		when(trashBin.content(trashed, TrashedMenu.class)).thenReturn(new TrashedMenu("Menu de Noël", "menu-de-noel", null,
				true, Instant.parse("2026-10-01T10:00:00Z"), List.of(new TrashedMenu.RecipeRef(1L, "buche"),
						new TrashedMenu.RecipeRef(2L, "tarte"), new TrashedMenu.RecipeRef(3L, "gone"))));
		when(menuRepository.findByTitle("Menu de Noël")).thenReturn(Optional.empty());
		Recipe log = recipe(1, "Bûche", RecipeStatus.PUBLISHED);
		// The tart was put in the trash and restored meanwhile: a new id, the same address
		Recipe tart = recipe(8, "Tarte", RecipeStatus.PUBLISHED);
		when(recipeRepository.findById(1L)).thenReturn(Optional.of(log));
		when(recipeRepository.findById(2L)).thenReturn(Optional.empty());
		when(recipeRepository.findBySlug("tarte")).thenReturn(Optional.of(tart));
		when(recipeRepository.findById(3L)).thenReturn(Optional.empty());
		when(recipeRepository.findBySlug("gone")).thenReturn(Optional.empty());
		when(menuRepository.saveAndFlush(any())).thenAnswer(call -> {
			Menu menu = call.getArgument(0);
			menu.setId(4L);
			when(menuRepository.findById(4L)).thenReturn(Optional.of(menu));
			return menu;
		});

		AdminMenu menu = service.restoreFromTrash(trashed);

		assertThat(menu.slug()).isEqualTo("menu-de-noel");
		assertThat(menu.recipes()).extracting(MenuRecipe::title).containsExactly("Bûche", "Tarte");
	}

	@Test
	void refusesToRestoreAMenuWhoseTitleIsTaken() {
		TrashItem trashed = new TrashItem();
		when(trashBin.content(trashed, TrashedMenu.class)).thenReturn(new TrashedMenu("Goûter", "gouter", null, false,
				Instant.now(), List.of()));
		when(menuRepository.findByTitle("Goûter")).thenReturn(Optional.of(menu(2, "Goûter", false)));

		assertThatThrownBy(() -> service.restoreFromTrash(trashed)).isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.MENU_ALREADY_EXISTS);
	}

	@Test
	void readsBackAMenuOfTheTrash() {
		JsonMapper json = JsonMapper.builder().build();
		TrashedMenu menu = new TrashedMenu("Goûter", "gouter", null, true, Instant.parse("2026-10-01T10:00:00Z"),
				List.of(new TrashedMenu.RecipeRef(1L, "tarte")));

		assertThat(json.readValue(json.writeValueAsString(menu), TrashedMenu.class)).isEqualTo(menu);
	}

}
