package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.cap.CapBlockType;
import fr.lescreationsdeyona.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

class CapAiServiceTest {

	private static final String ARTICLE = """
			{"hasArticle":true,"title":"Examen blanc","subtitle":null,"blocks":[
			  {"type":"TEXT","text":"Ce matin, examen blanc","caption":null,"stepCaptions":[]}]}""";

	private final Gemini gemini = mock(Gemini.class);

	private final Claude claude = mock(Claude.class);

	private final CapAiService service = new CapAiService(
			new OnlineAi(gemini, new GeminiStatus(gemini), claude, new ClaudeStatus(claude)), JsonMapper.builder().build());

	@Test
	void asksForNotesOrAPhoto() {
		when(gemini.configured()).thenReturn(true);

		assertThatThrownBy(() -> service.draft("  ", null, null)).extracting("code").isEqualTo(ErrorCode.CAP_AI_INPUT_REQUIRED);
		assertThatThrownBy(() -> service.draft("x".repeat(20_001), null, null)).extracting("code")
			.isEqualTo(ErrorCode.AI_TEXT_TOO_LONG);
		assertThatThrownBy(() -> service.draft(null, new MockMultipartFile("image", "notes.gif", "image/gif",
				new byte[] { 'G', 'I', 'F', '8', '9', 'a' }), null)).extracting("code")
			.isEqualTo(ErrorCode.IMAGE_FORMAT_UNSUPPORTED);
		assertThatThrownBy(() -> service.localPrompt(" ", null)).extracting("code").isEqualTo(ErrorCode.CAP_AI_INPUT_REQUIRED);
	}

	@Test
	void refusesWithoutAKey() {
		assertThatThrownBy(() -> service.draft("Examen blanc", null, null)).extracting("code")
			.isEqualTo(ErrorCode.AI_NOT_CONFIGURED);
	}

	@Test
	void tellsGeminiTheShapeAskedAndTheNotes() throws Exception {
		when(gemini.configured()).thenReturn(true);
		when(gemini.generate(anyString(), anyString(), any(), any())).thenReturn(ARTICLE);

		CapAiDraft draft = service.draft(" Examen blanc ce matin ", null, CapAiForm.STEPS);

		assertThat(draft.title()).isEqualTo("Examen blanc");
		assertThat(draft.blocks()).extracting("type").containsExactly(CapBlockType.TEXT);
		verify(gemini).generate(eq(CapAiPrompt.INSTRUCTIONS), contains("un pas à pas"), isNull(), any());
		verify(gemini).generate(anyString(), contains("Notes de Yona :\nExamen blanc ce matin"), isNull(), any());
	}

	@Test
	void explainsWhatGeminiAnswered() throws Exception {
		when(gemini.configured()).thenReturn(true);
		when(gemini.generate(anyString(), anyString(), any(), any()))
			.thenThrow(new Gemini.GeminiException(Gemini.Failure.DAILY_QUOTA, "HTTP 429"))
			.thenReturn("{\"hasArticle\":false}")
			.thenReturn("not json");

		assertThatThrownBy(() -> service.draft("Examen", null, null)).extracting("code").isEqualTo(ErrorCode.AI_DAILY_QUOTA);
		assertThatThrownBy(() -> service.draft("Facture EDF", null, null)).extracting("code")
			.isEqualTo(ErrorCode.CAP_AI_NO_ARTICLE);
		assertThatThrownBy(() -> service.draft("Examen", null, null)).extracting("code").isEqualTo(ErrorCode.AI_BAD_RESPONSE);
	}

	@Test
	void greysGeminiOutOnceItRefusedTheKey() throws Exception {
		when(gemini.configured()).thenReturn(true);
		when(gemini.checkKey()).thenReturn(Gemini.KeyCheck.UNKNOWN);
		when(gemini.generate(anyString(), anyString(), any(), any()))
			.thenThrow(new Gemini.GeminiException(Gemini.Failure.KEY_REFUSED, "HTTP 401"));

		assertThatThrownBy(() -> service.draft("Examen", null, null)).extracting("code").isEqualTo(ErrorCode.AI_KEY_REFUSED);
		assertThat(service.status().reason()).isEqualTo(ErrorCode.AI_KEY_REFUSED.message());
	}

	@Test
	void givesTheLocalModelTheRulesTheSchemaAndTheNotes() {
		CapAiLocalPrompt prompt = service.localPrompt("Pâte feuilletée en cours", CapAiForm.NOTEBOOK);

		assertThat(prompt.instructions()).startsWith(CapAiPrompt.INSTRUCTIONS).contains("\"hasArticle\"");
		assertThat(prompt.message()).startsWith(CapAiForm.NOTEBOOK.instruction).endsWith("Pâte feuilletée en cours");
	}

	@Test
	void checksTheAnswerOfTheLocalModel() {
		assertThat(service.localDraft("```json\n" + ARTICLE + "\n```").title()).isEqualTo("Examen blanc");
		assertThatThrownBy(() -> service.localDraft("Je ne peux pas")).extracting("code")
			.isEqualTo(ErrorCode.AI_LOCAL_BAD_RESPONSE);
		assertThatThrownBy(() -> service.localDraft("{\"hasArticle\":false}")).extracting("code")
			.isEqualTo(ErrorCode.CAP_AI_NO_ARTICLE);
	}

}
