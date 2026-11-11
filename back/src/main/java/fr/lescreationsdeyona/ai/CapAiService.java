package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.concurrent.Semaphore;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * "Écrire avec l'IA", in an article of "Mon CAP": Yona's notes (typed, or the photo of handwritten
 * ones) written by Gemini or Claude into a title and blocks, for the editor. Nothing is saved; the
 * admin checks it, adds the photos and saves as usual. The AI is called outside any transaction, one
 * article at a time.
 */
@Service
public class CapAiService {

	private final OnlineAi onlineAi;

	private final JsonMapper jsonMapper;

	private final Semaphore oneAtATime = new Semaphore(1);

	CapAiService(OnlineAi onlineAi, JsonMapper jsonMapper) {
		this.onlineAi = onlineAi;
		this.jsonMapper = jsonMapper;
	}

	/** The same as the recipes': one key, one quota. */
	public RecipeAiStatus status() {
		return onlineAi.geminiStatus();
	}

	public CapAiDraft draft(@Nullable String text, @Nullable MultipartFile image, @Nullable CapAiForm form) {
		return draft(text, image, form, AiEngine.GEMINI);
	}

	public CapAiDraft draft(@Nullable String text, @Nullable MultipartFile image, @Nullable CapAiForm form, AiEngine engine) {
		String notes = notes(text);
		Gemini.Image photo = image == null || image.isEmpty() ? null : RecipeAiService.photo(image);
		if (notes.isEmpty() && photo == null) {
			throw new ApiException(ErrorCode.CAP_AI_INPUT_REQUIRED);
		}
		onlineAi.checkConfigured(engine);
		if (!oneAtATime.tryAcquire()) {
			throw new ApiException(ErrorCode.AI_BUSY);
		}
		try {
			String answer = onlineAi.generate(engine, CapAiPrompt.INSTRUCTIONS, CapAiPrompt.message(notes, form), photo,
					CapAiPrompt.schema());
			return article(answer);
		} catch (JacksonException e) {
			throw new ApiException(engine == AiEngine.CLAUDE ? ErrorCode.CLAUDE_BAD_RESPONSE : ErrorCode.AI_BAD_RESPONSE);
		} finally {
			oneAtATime.release();
		}
	}

	/** Same rules as Gemini, the notes already in the message: only who writes the article changes. */
	public CapAiLocalPrompt localPrompt(String text, @Nullable CapAiForm form) {
		String notes = notes(text);
		if (notes.isEmpty()) {
			throw new ApiException(ErrorCode.CAP_AI_INPUT_REQUIRED);
		}
		return new CapAiLocalPrompt(CapAiPrompt.localInstructions(jsonMapper.writeValueAsString(CapAiPrompt.schema())),
				CapAiPrompt.message(notes, form));
	}

	/** Checked exactly as an answer of Gemini: nothing the model wrote is taken as it is. */
	public CapAiDraft localDraft(String answer) {
		try {
			return article(RecipeAiService.jsonIn(answer));
		} catch (JacksonException e) {
			throw new ApiException(ErrorCode.AI_LOCAL_BAD_RESPONSE);
		}
	}

	private CapAiDraft article(String answer) {
		CapAiDraft draft = CapAiReader.read(jsonMapper.readTree(answer));
		if (draft == null) {
			throw new ApiException(ErrorCode.CAP_AI_NO_ARTICLE);
		}
		return draft;
	}

	private static String notes(@Nullable String text) {
		String notes = text == null ? "" : text.strip();
		if (notes.length() > RecipeAiService.MAX_TEXT_LENGTH) {
			throw new ApiException(ErrorCode.AI_TEXT_TOO_LONG);
		}
		return notes;
	}

}
