package fr.lescreationsdeyona.cap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.cap.CapResponses.AdminCapEntry;
import fr.lescreationsdeyona.cap.CapResponses.CapArticle;
import fr.lescreationsdeyona.cap.CapResponses.TrashedCapEntry;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

class CapServiceTest {

	private static final UUID PHOTO = UUID.randomUUID();

	private final CapEntryRepository repository = mock(CapEntryRepository.class);

	private final ImageService images = mock(ImageService.class);

	private final TrashBin trashBin = mock(TrashBin.class);

	private final JsonMapper json = JsonMapper.builder().build();

	private final CapService service = new CapService(repository, images, trashBin, mock(AuditLog.class), json);

	@BeforeEach
	void setUp() {
		when(repository.saveAndFlush(any())).thenAnswer(invocation -> {
			CapEntry entry = invocation.getArgument(0);
			if (entry.getId() == null) {
				entry.setId(5L);
			}
			return entry;
		});
		when(images.landscapeIdsAmong(anyCollection())).thenReturn(Set.of(PHOTO));
	}

	private static CapEntryForm form(String title, boolean published, boolean featured, List<CapBlock> blocks) {
		return new CapEntryForm(title, " Un sous-titre ", LocalDate.parse("2026-10-12"), null, CapStyle.NOTEBOOK, blocks, published, featured);
	}

	private static CapBlock text(String text) {
		return new CapBlock(CapBlockType.TEXT, text, null, null, null, null);
	}

	private CapEntry existing(String title, String slug, boolean published) {
		CapEntry entry = new CapEntry();
		entry.setId(5L);
		entry.setTitle(title);
		entry.setSlug(slug);
		entry.setHappenedOn(LocalDate.parse("2026-10-12"));
		entry.setStyle(CapStyle.CLASSIC);
		entry.setBlocks("[]");
		entry.setPublished(published);
		when(repository.findById(5L)).thenReturn(Optional.of(entry));
		return entry;
	}

	@Test
	void makesTheAddressFromTheTitle() {
		AdminCapEntry created = service.createEntry(form("mon premier examen blanc", true, false, List.of(text(" Bonjour "))));

		assertThat(created.slug()).isEqualTo("mon-premier-examen-blanc");
		assertThat(created.title()).isEqualTo("Mon premier examen blanc");
		assertThat(created.subtitle()).isEqualTo("Un sous-titre");
		assertThat(created.style()).isEqualTo(CapStyle.NOTEBOOK);
		assertThat(created.blocks()).containsExactly(text("Bonjour"));
	}

	@Test
	void neverTakesTheOldAddressOfTheObservations() {
		assertThat(service.createEntry(form("Observations", false, false, List.of())).slug()).isEqualTo("observations-2");
	}

	@Test
	void givesAnotherAddressWhenTaken() {
		when(repository.existsBySlug("examen-blanc")).thenReturn(true);

		assertThat(service.createEntry(form("Examen blanc", false, false, List.of())).slug()).isEqualTo("examen-blanc-2");
	}

	@Test
	void followsTheTitleWhileADraft() {
		existing("Brouillon", "brouillon", false);

		assertThat(service.updateEntry(5, form("Mon examen", false, false, List.of())).slug()).isEqualTo("mon-examen");
	}

	@Test
	void keepsTheAddressOncePublished() {
		existing("Mon examen", "mon-examen", true);

		assertThat(service.updateEntry(5, form("Mon examen blanc", true, false, List.of())).slug()).isEqualTo("mon-examen");
	}

	@Test
	void keepsItsOwnAddressWhenTheTitleDoesNotChange() {
		existing("Mon examen", "mon-examen", false);
		when(repository.existsBySlug("mon-examen")).thenReturn(true);

		assertThat(service.updateEntry(5, form("Mon examen", false, false, List.of())).slug()).isEqualTo("mon-examen");
	}

	@Test
	void putsOneArticleForwardAtMost() {
		existing("Mon examen", "mon-examen", true);

		service.updateEntry(5, form("Mon examen", true, true, List.of()));

		verify(repository).unfeatureAllExcept(5L);
	}

	@Test
	void leavesTheOthersForwardWhenNotChosen() {
		service.createEntry(form("Mon examen", true, false, List.of()));

		verify(repository, never()).unfeatureAllExcept(anyLong());
	}

	@Test
	void dropsThePhotosGoneFromTheGallery() {
		UUID gone = UUID.randomUUID();

		AdminCapEntry created = service.createEntry(form("Photos", true, false,
				List.of(new CapBlock(CapBlockType.IMAGE, null, gone, "Partie", null, null), new CapBlock(CapBlockType.IMAGE, null, PHOTO, null, null, null))));

		assertThat(created.blocks()).extracting(CapBlock::imageId).containsExactly(null, PHOTO);
	}

	@Test
	void showsVisitorsAPublishedArticleWithoutItsEmptyBlocks() {
		CapEntry entry = existing("Mon examen", "mon-examen", true);
		entry.setBlocks(CapBlocks.write(json, List.of(text("Le matin"), new CapBlock(CapBlockType.IMAGE, null, null, null, null, null))));
		when(repository.findBySlugAndPublishedTrue("mon-examen")).thenReturn(Optional.of(entry));

		CapArticle article = service.publishedEntry("mon-examen");

		assertThat(article.blocks()).containsExactly(text("Le matin"));
		assertThat(article.excerpt()).isEqualTo("Le matin");
	}

	@Test
	void hidesADraftOrAnUnknownArticle() {
		assertThatThrownBy(() -> service.publishedEntry("brouillon")).extracting("code").isEqualTo(ErrorCode.CAP_ENTRY_NOT_FOUND);
		assertThatThrownBy(() -> service.entry(99)).extracting("code").isEqualTo(ErrorCode.CAP_ENTRY_NOT_FOUND);
	}

	@Test
	void putsForwardTheChosenArticleThenTheLatest() {
		CapEntry latest = existing("Le dernier", "le-dernier", true);
		when(repository.findFirstByPublishedTrueOrderByHappenedOnDescIdDesc()).thenReturn(Optional.of(latest));
		assertThat(service.highlight().featured()).isFalse();

		CapEntry chosen = existing("Coup de cœur", "coup-de-coeur", true);
		when(repository.findFirstByPublishedTrueAndFeaturedTrue()).thenReturn(Optional.of(chosen));
		assertThat(service.highlight().featured()).isTrue();
		assertThat(service.highlight().article().slug()).isEqualTo("coup-de-coeur");
	}

	@Test
	void putsNothingForwardBeforeTheFirstArticle() {
		assertThat(service.highlight()).isNull();
	}

	@Test
	void keepsAnArticleInTheTrash() {
		CapEntry entry = existing("Mon examen", "mon-examen", true);
		entry.setBlocks(CapBlocks.write(json, List.of(text("Le matin"))));

		service.deleteEntry(5);

		ArgumentCaptor<TrashBin.Entry> trashed = ArgumentCaptor.forClass(TrashBin.Entry.class);
		verify(trashBin).put(trashed.capture());
		TrashedCapEntry kept = (TrashedCapEntry) trashed.getValue().content();
		assertThat(kept.blocks()).containsExactly(text("Le matin"));
		assertThat(kept.slug()).isEqualTo("mon-examen");
		verify(repository).delete(entry);
	}

	@Test
	void bringsBackAStepTrashedBeforeTheArticlesAsAText() {
		TrashItem item = new TrashItem();
		when(trashBin.content(item, TrashedCapEntry.class)).thenReturn(
				new TrashedCapEntry("Inscription", null, null, "Le dossier est parti", LocalDate.parse("2026-09-01"), null, null, true));

		AdminCapEntry restored = service.restoreEntryFromTrash(item);

		assertThat(restored.blocks()).containsExactly(text("Le dossier est parti"));
		assertThat(restored.style()).isEqualTo(CapStyle.CLASSIC);
		assertThat(restored.slug()).isEqualTo("inscription");
		assertThat(restored.featured()).isFalse();
	}

	@Test
	void givesBackItsAddressOnlyIfStillFree() {
		TrashItem item = new TrashItem();
		when(trashBin.content(item, TrashedCapEntry.class)).thenReturn(new TrashedCapEntry("Examen", null, "examen", null,
				LocalDate.parse("2026-09-01"), CapStyle.NOTEBOOK, List.of(), false));
		when(repository.existsBySlug("examen")).thenReturn(true);

		assertThat(service.restoreEntryFromTrash(item).slug()).isEqualTo("examen-2");
	}

	@Test
	void refusesTooManyBlocks() {
		List<CapBlock> blocks = java.util.Collections.nCopies(CapBlocks.MAX_BLOCKS + 1, text("a"));

		assertThatThrownBy(() -> service.createEntry(form("Trop", false, false, blocks))).extracting("code")
			.isEqualTo(ErrorCode.CAP_BLOCKS_TOO_MANY);
	}

}
