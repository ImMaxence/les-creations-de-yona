package fr.lescreationsdeyona.trash;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class TrashBatchServiceTest {

	private final TrashService trashService = mock(TrashService.class);

	private final TrashItemRepository trashRepository = mock(TrashItemRepository.class);

	private final TrashBatchService service = new TrashBatchService(trashService, trashRepository);

	private static TrashItem item(long id, TrashKind kind, String title) {
		TrashItem item = new TrashItem();
		item.setId(id);
		item.setKind(kind);
		item.setTitle(title);
		item.setDeletedAt(Instant.parse("2026-10-20T10:00:00Z").plusSeconds(id));
		return item;
	}

	private static TrashRestored restored(TrashKind kind, String title) {
		return new TrashRestored(kind, title, 1L, null, 0);
	}

	@Test
	void restoresWhatOthersNeedFirst() {
		when(trashRepository.findAllById(any())).thenReturn(List.of(item(1, TrashKind.MENU, "Noël"),
				item(2, TrashKind.RECIPE, "Bûche"), item(3, TrashKind.CATEGORY, "Fêtes"), item(4, TrashKind.IMAGE, "Photo")));
		when(trashService.restore(anyLong())).thenAnswer(call -> restored(TrashKind.RECIPE, "x"));

		service.restore(List.of(1L, 2L, 3L, 4L));

		InOrder order = inOrder(trashService);
		order.verify(trashService).restore(4L);
		order.verify(trashService).restore(3L);
		order.verify(trashService).restore(2L);
		order.verify(trashService).restore(1L);
	}

	@Test
	void reportsWhatCannotComeBackAndRestoresTheRest() {
		when(trashRepository.findAllById(any())).thenReturn(List.of(item(1, TrashKind.RECIPE, "Tarte"),
				item(2, TrashKind.MENU, "Goûter")));
		when(trashService.restore(1L)).thenReturn(restored(TrashKind.RECIPE, "Tarte"));
		when(trashService.restore(2L)).thenThrow(new ApiException(ErrorCode.MENU_ALREADY_EXISTS));

		TrashBatchRestored result = service.restore(List.of(1L, 2L));

		assertThat(result.restored()).extracting(TrashRestored::title).containsExactly("Tarte");
		assertThat(result.failed()).containsExactly(
				new TrashBatchRestored.Failure(2L, "Goûter", ErrorCode.MENU_ALREADY_EXISTS.message()));
	}

	@Test
	void refusesAtOnceAnIdNoLongerInTheTrash() {
		when(trashRepository.findAllById(any())).thenReturn(List.of(item(1, TrashKind.RECIPE, "Tarte")));

		assertThatThrownBy(() -> service.restore(List.of(1L, 9L))).isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.TRASH_ITEM_NOT_FOUND);
		verify(trashService, never()).restore(anyLong());
	}

	private static <T> T any() {
		return org.mockito.ArgumentMatchers.any();
	}

}
