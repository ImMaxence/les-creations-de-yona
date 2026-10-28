package fr.lescreationsdeyona.tag;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

class TagServiceTrashTest {

	private final TagRepository repository = mock(TagRepository.class);

	private final TrashBin trashBin = mock(TrashBin.class);

	private final TagService service = new TagService(repository, mock(TagMapper.class), trashBin, mock(AuditLog.class),
			mock(JdbcClient.class));

	@Test
	void comesBackOnItsRecipesFoundByIdOrAddress() {
		TrashItem trashed = new TrashItem();
		when(trashBin.content(trashed, TrashedTag.class)).thenReturn(new TrashedTag("Végétarien", "vegetarien"));
		when(trashBin.links(trashed, TrashedTag.Links.class, TrashedTag.Links.NONE)).thenReturn(new TrashedTag.Links(
				List.of(new TrashedTag.RecipeRef(1L, "tarte"), new TrashedTag.RecipeRef(2L, "soupe"))));
		when(repository.saveAndFlush(any())).thenAnswer(call -> {
			Tag tag = call.getArgument(0);
			tag.setId(9L);
			return tag;
		});
		when(repository.addToRecipes(9L, List.of(1L, 2L), List.of("tarte", "soupe"))).thenReturn(2);

		TagService.TagRestored restored = service.restoreFromTrash(trashed);

		assertThat(restored.tag().slug()).isEqualTo("vegetarien");
		assertThat(restored.recipesBack()).isEqualTo(2);
	}

	@Test
	void refusesANameTakenMeanwhile() {
		TrashItem trashed = new TrashItem();
		when(trashBin.content(trashed, TrashedTag.class)).thenReturn(new TrashedTag("Végétarien", "vegetarien"));
		when(repository.existsByName("Végétarien")).thenReturn(true);

		assertThatThrownBy(() -> service.restoreFromTrash(trashed)).extracting("code").isEqualTo(ErrorCode.TAG_ALREADY_EXISTS);
	}

	@Test
	void findsATagRestoredMeanwhileByItsAddress() {
		when(repository.existsById(3L)).thenReturn(false);
		Tag restored = new Tag();
		restored.setId(12L);
		when(repository.findBySlug("vegetarien")).thenReturn(Optional.of(restored));
		when(repository.existsById(4L)).thenReturn(true);

		assertThat(service.stillExisting(List.of(new TagResponse(3L, "Végétarien", "vegetarien"),
				new TagResponse(4L, "Rapide", "rapide"), new TagResponse(5L, "Disparu", "disparu"))))
			.containsExactly(12L, 4L);
	}

	@Test
	void readsBackATagOfTheTrash() {
		JsonMapper json = JsonMapper.builder().build();
		TrashedTag.Links links = new TrashedTag.Links(List.of(new TrashedTag.RecipeRef(1L, "tarte")));

		assertThat(json.readValue(json.writeValueAsString(links), TrashedTag.Links.class)).isEqualTo(links);
	}

}
