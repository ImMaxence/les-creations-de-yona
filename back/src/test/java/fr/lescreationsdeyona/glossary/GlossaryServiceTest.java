package fr.lescreationsdeyona.glossary;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class GlossaryServiceTest {

	private final GlossaryTermRepository repository = mock(GlossaryTermRepository.class);

	private final TrashBin trashBin = mock(TrashBin.class);

	private final GlossaryService service = new GlossaryService(repository, trashBin, mock(AuditLog.class));

	private static GlossaryTerm term(long id, String name, String definition) {
		GlossaryTerm term = new GlossaryTerm();
		term.setId(id);
		term.setName(name);
		term.setSlug(name.toLowerCase());
		term.setDefinition(definition);
		return term;
	}

	@BeforeEach
	void setUp() {
		when(repository.saveAndFlush(any())).thenAnswer(invocation -> {
			GlossaryTerm term = invocation.getArgument(0);
			if (term.getId() == null) {
				term.setId(9L);
			}
			return term;
		});
		when(repository.findAll(any(Sort.class))).thenReturn(List.of(term(1, "Abaisser", "Étaler au rouleau"), term(2, "Tourer", null)));
	}

	@Test
	void showsTheSiteTheWordsDefinedOnly() {
		assertThat(service.list()).extracting(GlossaryTermResponse::name).containsExactly("Abaisser");
	}

	@Test
	void showsTheBackOfficeTheWordsToComplete() {
		assertThat(service.adminList()).extracting(GlossaryTermResponse::name).containsExactly("Abaisser", "Tourer");
		assertThat(service.adminList().get(1).definition()).isNull();
	}

	@Test
	void keepsAWordForLater() {
		GlossaryTermResponse kept = service.create(new GlossaryTermForm("tourer", "  ", List.of()));

		assertThat(kept.name()).isEqualTo("Tourer");
		assertThat(kept.definition()).isNull();
		assertThat(kept.slug()).isEqualTo("tourer");
	}

	@Test
	void completesAWordKeptForLater() {
		when(repository.findById(2L)).thenReturn(Optional.of(term(2, "Tourer", null)));

		GlossaryTermResponse done = service.update(2, new GlossaryTermForm("Tourer", " Donner des tours à une pâte ", List.of("tourez", "Tourer")));

		assertThat(done.definition()).isEqualTo("Donner des tours à une pâte");
		// The name itself is not another form
		assertThat(done.forms()).containsExactly("tourez");
	}

	@Test
	void refusesAWordAlreadyThere() {
		when(repository.existsByName("Tourer")).thenReturn(true);

		assertThatThrownBy(() -> service.create(new GlossaryTermForm("Tourer", null, List.of()))).extracting("code")
			.isEqualTo(ErrorCode.GLOSSARY_TERM_ALREADY_EXISTS);
	}

	@Test
	void bringsBackAWordKeptForLaterFromTheTrash() {
		TrashItem item = new TrashItem();
		when(trashBin.content(item, TrashedGlossaryTerm.class)).thenReturn(new TrashedGlossaryTerm("Tourer", "tourer", null, List.of()));

		assertThat(service.restoreFromTrash(item).definition()).isNull();
	}

}
