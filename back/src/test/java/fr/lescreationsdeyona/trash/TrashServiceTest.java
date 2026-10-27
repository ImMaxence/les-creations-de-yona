package fr.lescreationsdeyona.trash;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.category.CategoryService;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.recipe.RecipeDetail;
import fr.lescreationsdeyona.recipe.RecipeLinks;
import fr.lescreationsdeyona.recipe.RecipeService;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TrashServiceTest {

	private final TrashItemRepository trashRepository = mock(TrashItemRepository.class);

	private final TrashBin trashBin = mock(TrashBin.class);

	private final RecipeService recipeService = mock(RecipeService.class);

	private final MenuService menuService = mock(MenuService.class);

	private final ImageService imageService = mock(ImageService.class);

	private final TrashService service = new TrashService(trashRepository, trashBin, recipeService,
			mock(CategoryService.class), menuService, imageService);

	private static TrashItem item(long id, TrashKind kind) {
		TrashItem item = new TrashItem();
		item.setId(id);
		item.setKind(kind);
		item.setTitle("Tarte");
		item.setDeletedAt(Instant.parse("2026-10-01T10:00:00Z"));
		return item;
	}

	@Test
	void restoresARecipeBackInItsMenusThenTakesItOutOfTheTrash() {
		TrashItem trashed = item(1, TrashKind.RECIPE);
		RecipeDetail recipe = mock(RecipeDetail.class);
		when(recipe.id()).thenReturn(9L);
		when(recipe.title()).thenReturn("Tarte");
		when(recipe.status()).thenReturn(RecipeStatus.PUBLISHED);
		List<RecipeLinks.MenuPlace> places = List.of(new RecipeLinks.MenuPlace(3L, 0));
		when(trashRepository.findById(1L)).thenReturn(Optional.of(trashed));
		when(recipeService.restoreFromTrash(trashed)).thenReturn(recipe);
		when(trashBin.links(eq(trashed), eq(RecipeLinks.class), any())).thenReturn(new RecipeLinks(places));
		when(menuService.addBack(9L, places)).thenReturn(1);

		TrashRestored restored = service.restore(1);

		assertThat(restored).isEqualTo(new TrashRestored(TrashKind.RECIPE, "Tarte", 9L, RecipeStatus.PUBLISHED, 1));
		verify(trashRepository).delete(trashed);
	}

	@Test
	void erasesThePhotoFilesWithTheTrashOnly() {
		TrashItem photo = item(1, TrashKind.IMAGE);
		when(trashRepository.findByKind(TrashKind.IMAGE)).thenReturn(List.of(photo));

		service.eraseAll();

		verify(imageService).eraseFromTrash(photo);
		verify(trashRepository).deleteAllInBatch();
	}

	@Test
	void leavesTheGalleryAloneWhenErasingARecipe() {
		TrashItem recipe = item(2, TrashKind.RECIPE);
		when(trashRepository.findById(2L)).thenReturn(Optional.of(recipe));

		service.erase(2);

		verify(imageService, never()).eraseFromTrash(any());
		verify(trashRepository).deleteAll(List.of(recipe));
	}

	@Test
	void listsWhenEachThingWillBeErased() {
		when(trashRepository.findAllByOrderByDeletedAtDesc()).thenReturn(List.of(item(1, TrashKind.MENU)));

		assertThat(service.list().getFirst().erasedAt()).isEqualTo(Instant.parse("2026-10-31T10:00:00Z"));
	}

	@Test
	void erasesASelectionAllOrNone() {
		TrashItem photo = item(1, TrashKind.IMAGE);
		TrashItem menu = item(2, TrashKind.MENU);
		when(trashRepository.findAllById(any())).thenReturn(List.of(photo, menu));

		service.eraseSelected(List.of(1L, 2L, 2L));

		verify(imageService).eraseFromTrash(photo);
		verify(trashRepository).deleteAll(List.of(photo, menu));
	}

	@Test
	void erasesNothingWhenOneIsNoLongerInTheTrash() {
		when(trashRepository.findAllById(any())).thenReturn(List.of(item(1, TrashKind.MENU)));

		assertThatThrownBy(() -> service.eraseSelected(List.of(1L, 9L))).isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.TRASH_ITEM_NOT_FOUND);
		verify(trashRepository, never()).deleteAll(any());
	}

}
