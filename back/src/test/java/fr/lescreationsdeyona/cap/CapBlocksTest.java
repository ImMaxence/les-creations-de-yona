package fr.lescreationsdeyona.cap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.lescreationsdeyona.cap.CapBlock.CapBlockPhoto;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CapBlocksTest {

	private static final UUID KEPT = UUID.randomUUID();

	private static final UUID GONE = UUID.randomUUID();

	private static final Set<UUID> GALLERY = Set.of(KEPT);

	private static CapBlock text(String text) {
		return new CapBlock(CapBlockType.TEXT, text, null, null, null, null);
	}

	@Test
	void keepsTheFieldsOfEachTypeOnly() {
		List<CapBlock> tidied = CapBlocks.tidy(List.of(
				new CapBlock(CapBlockType.TEXT, "  Le matin  ", KEPT, "Légende", CapBlockSide.RIGHT, List.of()),
				new CapBlock(CapBlockType.IMAGE, "texte", KEPT, "  Ma tarte ", CapBlockSide.RIGHT, null),
				new CapBlock(CapBlockType.IMAGE_TEXT, "Un mot", KEPT, " ", null, null)), GALLERY::contains);

		assertThat(tidied.get(0)).isEqualTo(text("Le matin"));
		assertThat(tidied.get(1)).isEqualTo(new CapBlock(CapBlockType.IMAGE, null, KEPT, "Ma tarte", null, null));
		// A photo + text on the left unless told, an empty caption dropped
		assertThat(tidied.get(2)).isEqualTo(new CapBlock(CapBlockType.IMAGE_TEXT, "Un mot", KEPT, null, CapBlockSide.LEFT, null));
	}

	@Test
	void dropsThePhotosTheGalleryDoesNotHave() {
		List<CapBlock> tidied = CapBlocks.tidy(List.of(new CapBlock(CapBlockType.STEPS, null, null, null, null,
				List.of(new CapBlockPhoto(KEPT, "1"), new CapBlockPhoto(GONE, "2")))), GALLERY::contains);

		assertThat(tidied.getFirst().photos()).containsExactly(new CapBlockPhoto(KEPT, "1"), new CapBlockPhoto(null, "2"));
	}

	@Test
	void refusesTooManyBlocksOrALongTip() {
		List<CapBlock> many = new ArrayList<>(Collections.nCopies(CapBlocks.MAX_BLOCKS + 1, text("a")));
		assertThatThrownBy(() -> CapBlocks.tidy(many, GALLERY::contains)).extracting("code").isEqualTo(ErrorCode.CAP_BLOCKS_TOO_MANY);

		CapBlock tip = new CapBlock(CapBlockType.TIP, "a".repeat(CapBlocks.MAX_TIP_LENGTH + 1), null, null, null, null);
		assertThatThrownBy(() -> CapBlocks.tidy(List.of(tip), GALLERY::contains)).extracting("code")
			.isEqualTo(ErrorCode.CAP_TIP_TOO_LONG);
	}

	@Test
	void showsVisitorsWhatIsFilledOnly() {
		List<CapBlock> shown = CapBlocks.shown(List.of(text(null), new CapBlock(CapBlockType.IMAGE, null, GONE, "Partie", null, null),
				new CapBlock(CapBlockType.IMAGE_TEXT, "Reste", GONE, "Légende", CapBlockSide.RIGHT, null),
				new CapBlock(CapBlockType.STEPS, null, null, null, null, List.of(new CapBlockPhoto(GONE, "1"))),
				new CapBlock(CapBlockType.TIP, "Astuce", null, null, null, null)), GALLERY::contains);

		assertThat(shown).containsExactly(new CapBlock(CapBlockType.IMAGE_TEXT, "Reste", null, null, CapBlockSide.RIGHT, null),
				new CapBlock(CapBlockType.TIP, "Astuce", null, null, null, null));
	}

	@Test
	void listsEveryPhotoOnce() {
		assertThat(CapBlocks.imageIds(List.of(new CapBlock(CapBlockType.IMAGE, null, KEPT, null, null, null),
				new CapBlock(CapBlockType.STEPS, null, null, null, null, List.of(new CapBlockPhoto(KEPT, null), new CapBlockPhoto(GONE, null))))))
			.containsExactly(KEPT, GONE);
	}

	@Test
	void startsTheTimelineWithTheTextWithoutItsMarkdown() {
		assertThat(CapBlocks.excerpt(List.of(new CapBlock(CapBlockType.IMAGE, null, KEPT, null, null, null),
				text("## Le matin\n\n**Une pâte** [feuilletée](/recettes/viennoiseries/feuilletage) _récalcitrante_\n- un pli"))))
			.isEqualTo("Le matin Une pâte feuilletée récalcitrante un pli");
		assertThat(CapBlocks.excerpt(List.of(new CapBlock(CapBlockType.TIP, "Astuce", null, null, null, null)))).isNull();
	}

	@Test
	void cutsALongTextAtAWord() {
		String excerpt = CapBlocks.excerpt(List.of(text("Une phrase assez longue, ".repeat(30))));

		assertThat(excerpt).hasSizeLessThanOrEqualTo(CapBlocks.EXCERPT_LENGTH + 1).endsWith("assez…");
	}

	@Test
	void turnsTheTextOfAnOldStepIntoATextBlock() {
		assertThat(CapBlocks.fromText("  Inscription  ")).containsExactly(text("Inscription"));
		assertThat(CapBlocks.fromText(" ")).isEmpty();
	}

	@Test
	void readsBackWhatItWrites() {
		JsonMapper json = JsonMapper.builder().build();
		List<CapBlock> blocks = List.of(text("Le matin"), new CapBlock(CapBlockType.IMAGE_TEXT, "Mot", KEPT, null, CapBlockSide.RIGHT, null),
				new CapBlock(CapBlockType.STEPS, null, null, null, null, List.of(new CapBlockPhoto(KEPT, "Étape"))));

		assertThat(CapBlocks.read(json, CapBlocks.write(json, blocks))).isEqualTo(blocks);
		// As the migration wrote the text of the steps of before
		assertThat(CapBlocks.read(json, "[{\"type\": \"TEXT\", \"text\": \"Inscription\"}]")).containsExactly(text("Inscription"));
	}

	@Test
	void namesTheBlocksForTheHistory() {
		assertThat(CapBlocks.summary(List.of(text("a"), new CapBlock(CapBlockType.IMAGE, null, null, null, null, null))))
			.isEqualTo("Texte, Grande photo");
	}

}
