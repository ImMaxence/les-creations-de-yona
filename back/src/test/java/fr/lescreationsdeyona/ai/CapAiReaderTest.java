package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.cap.CapBlock;
import fr.lescreationsdeyona.cap.CapBlock.CapBlockPhoto;
import fr.lescreationsdeyona.cap.CapBlockSide;
import fr.lescreationsdeyona.cap.CapBlockType;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CapAiReaderTest {

	private final JsonMapper json = JsonMapper.builder().build();

	private CapAiDraft read(String answer) {
		return CapAiReader.read(json.readTree(answer));
	}

	@Test
	void writesTheBlocksWithTheirPlacesForPhotos() {
		CapAiDraft draft = read("""
				{"hasArticle":true,"title":"  Mon premier examen blanc ","subtitle":"",
				"blocks":[
				  {"type":"TEXT","text":"# Le matin\\nJ'ai revu la [pâte brisée](https://exemple.fr).","caption":"ignorée","stepCaptions":["x"]},
				  {"type":"IMAGE","text":"ignoré","caption":"La tarte aux pommes","stepCaptions":[]},
				  {"type":"IMAGE_TEXT","text":"Les choux ont gonflé","caption":null,"stepCaptions":[]},
				  {"type":"IMAGE_TEXT","text":"Le craquelin était trop épais","caption":"Craquelin","stepCaptions":[]},
				  {"type":"IMAGE_TEXT","text":"  ","caption":"Sans texte","stepCaptions":[]},
				  {"type":"QUOTE","text":"Un type inconnu","caption":null,"stepCaptions":[]},
				  {"type":"TIP","text":"","caption":null,"stepCaptions":[]},
				  {"type":"TIP","text":"Retirer la crème du feu dès les premiers bouillons","caption":null,"stepCaptions":[]}
				]}""");

		assertThat(draft.title()).isEqualTo("Mon premier examen blanc");
		assertThat(draft.subtitle()).isNull();
		assertThat(draft.blocks()).containsExactly(
				new CapBlock(CapBlockType.TEXT, "## Le matin\nJ'ai revu la pâte brisée.", null, null, null, null),
				new CapBlock(CapBlockType.IMAGE, null, null, "La tarte aux pommes", null, null),
				new CapBlock(CapBlockType.IMAGE_TEXT, "Les choux ont gonflé", null, null, CapBlockSide.LEFT, null),
				new CapBlock(CapBlockType.IMAGE_TEXT, "Le craquelin était trop épais", null, "Craquelin", CapBlockSide.RIGHT, null),
				// A photo + text without text: the place of a big photo
				new CapBlock(CapBlockType.IMAGE, null, null, "Sans texte", null, null),
				new CapBlock(CapBlockType.TIP, "Retirer la crème du feu dès les premiers bouillons", null, null, null, null));
	}

	@Test
	void keepsTwoToEightStepsWithTheirCaptions() {
		CapAiDraft few = read("""
				{"hasArticle":true,"title":null,"subtitle":null,"blocks":[
				  {"type":"TEXT","text":"Pâte feuilletée","caption":null,"stepCaptions":[]},
				  {"type":"STEPS","text":null,"caption":null,"stepCaptions":["Faire la détrempe"," "]}]}""");
		CapAiDraft many = read("""
				{"hasArticle":true,"title":null,"subtitle":null,"blocks":[
				  {"type":"TEXT","text":"Pâte feuilletée","caption":null,"stepCaptions":[]},
				  {"type":"STEPS","text":null,"caption":null,"stepCaptions":["1","2","3","4","5","6","7","8","9"]}]}""");

		assertThat(few.blocks().get(1).photos()).containsExactly(new CapBlockPhoto(null, "Faire la détrempe"),
				new CapBlockPhoto(null, null));
		assertThat(many.blocks().get(1).photos()).hasSize(8).last().isEqualTo(new CapBlockPhoto(null, "8"));
	}

	@Test
	void cutsTextsToTheEditorsLimits() {
		CapAiDraft draft = read("""
				{"hasArticle":true,"title":"%s","subtitle":null,"blocks":[
				  {"type":"TIP","text":"%s","caption":null,"stepCaptions":[]}]}""".formatted("t".repeat(200), "a".repeat(1200)));

		assertThat(draft.title()).hasSize(150);
		assertThat(draft.blocks().getFirst().text()).hasSize(1000);
	}

	@Test
	void findsNoArticleWithoutAnyText() {
		assertThat(read("{\"hasArticle\":false,\"title\":\"Facture\",\"blocks\":[]}")).isNull();
		assertThat(read("""
				{"hasArticle":true,"title":"Photos","subtitle":null,"blocks":[
				  {"type":"IMAGE","text":null,"caption":"Une photo","stepCaptions":[]}]}""")).isNull();
		assertThat(read("{}")).isNull();
	}

	@Test
	void keepsTwentyBlocksAtMost() {
		String block = "{\"type\":\"TEXT\",\"text\":\"Paragraphe\",\"caption\":null,\"stepCaptions\":[]}";
		CapAiDraft draft = read("{\"hasArticle\":true,\"title\":null,\"subtitle\":null,\"blocks\":["
				+ String.join(",", Collections.nCopies(30, block)) + "]}");

		assertThat(draft.blocks()).hasSize(20);
	}

}
