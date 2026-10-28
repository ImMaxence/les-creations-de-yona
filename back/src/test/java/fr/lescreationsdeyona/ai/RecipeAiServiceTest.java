package fr.lescreationsdeyona.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.tag.TagRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

class RecipeAiServiceTest {

	private final Gemini gemini = mock(Gemini.class);

	private final RecipeAiService service = new RecipeAiService(gemini, JsonMapper.builder().build(),
			mock(CategoryRepository.class), mock(TagRepository.class), mock(IngredientRepository.class));

	@Test
	void greysTheButtonOutWithoutAKeyOrWithARefusedOne() {
		assertThat(service.status().available()).isFalse();

		when(gemini.configured()).thenReturn(true);
		when(gemini.checkKey()).thenReturn(Gemini.KeyCheck.REFUSED);
		assertThat(service.status().reason()).isEqualTo(ErrorCode.AI_KEY_REFUSED.message());
	}

	@Test
	void greysTheButtonOutUntilTheDailyQuotaStartsAgain() {
		Instant tomorrow = Instant.parse("2026-10-29T07:00:00Z");
		when(gemini.configured()).thenReturn(true);
		when(gemini.checkKey()).thenReturn(Gemini.KeyCheck.VALID);
		when(gemini.exhaustedUntil()).thenReturn(Optional.of(tomorrow));

		RecipeAiStatus status = service.status();

		assertThat(status.available()).isFalse();
		assertThat(status.availableAgainAt()).isEqualTo(tomorrow);
	}

	@Test
	void leavesTheButtonUsableWhenGoogleDoesNotAnswer() {
		when(gemini.configured()).thenReturn(true);
		when(gemini.checkKey()).thenReturn(Gemini.KeyCheck.UNKNOWN);
		when(gemini.exhaustedUntil()).thenReturn(Optional.empty());

		assertThat(service.status().available()).isTrue();
	}

	@Test
	void asksForATextOrAPhoto() {
		when(gemini.configured()).thenReturn(true);

		assertThatThrownBy(() -> service.draft("  ", null)).extracting("code").isEqualTo(ErrorCode.AI_INPUT_REQUIRED);
		assertThatThrownBy(() -> service.draft("x".repeat(20_001), null)).extracting("code")
			.isEqualTo(ErrorCode.AI_TEXT_TOO_LONG);
		assertThatThrownBy(() -> service.draft(null, new MockMultipartFile("image", "recette.gif", "image/gif",
				new byte[] { 'G', 'I', 'F', '8', '9', 'a' }))).extracting("code").isEqualTo(ErrorCode.IMAGE_FORMAT_UNSUPPORTED);
	}

	@Test
	void explainsWhatGeminiAnswered() throws Exception {
		when(gemini.configured()).thenReturn(true);
		when(gemini.generate(anyString(), anyString(), any(), any()))
			.thenThrow(new Gemini.GeminiException(Gemini.Failure.UNAVAILABLE, "HTTP 503"))
			.thenReturn("{\"isRecipe\":false}")
			.thenReturn("not json");

		assertThatThrownBy(() -> service.draft("Crêpes", null)).extracting("code").isEqualTo(ErrorCode.AI_UNAVAILABLE);
		assertThatThrownBy(() -> service.draft("Facture EDF", null)).extracting("code").isEqualTo(ErrorCode.AI_NOT_A_RECIPE);
		assertThatThrownBy(() -> service.draft("Crêpes", null)).extracting("code").isEqualTo(ErrorCode.AI_BAD_RESPONSE);
	}

}
