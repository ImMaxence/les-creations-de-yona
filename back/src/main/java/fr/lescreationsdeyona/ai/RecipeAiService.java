package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.tag.Tag;
import fr.lescreationsdeyona.tag.TagRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * "Remplir avec l'IA": a pasted recipe, or the photo of one, read by Gemini or Claude into a draft
 * for the editor. Nothing is saved; the admin checks it and saves as usual. The AI is called outside
 * any transaction, one recipe at a time: it takes a few seconds, sometimes half a minute.
 */
@Service
public class RecipeAiService {

	static final int MAX_TEXT_LENGTH = 20_000;

	private final OnlineAi onlineAi;

	private final JsonMapper jsonMapper;

	private final CategoryRepository categoryRepository;

	private final TagRepository tagRepository;

	private final IngredientRepository ingredientRepository;

	private final Semaphore oneAtATime = new Semaphore(1);

	RecipeAiService(OnlineAi onlineAi, JsonMapper jsonMapper, CategoryRepository categoryRepository,
			TagRepository tagRepository, IngredientRepository ingredientRepository) {
		this.onlineAi = onlineAi;
		this.jsonMapper = jsonMapper;
		this.categoryRepository = categoryRepository;
		this.tagRepository = tagRepository;
		this.ingredientRepository = ingredientRepository;
	}

	/** Asked when the editor opens: greys the button out when it cannot work at all. */
	public RecipeAiStatus status() {
		return onlineAi.geminiStatus();
	}

	public RecipeAiDraft draft(@Nullable String text, @Nullable MultipartFile image) {
		return draft(text, image, AiEngine.GEMINI);
	}

	public RecipeAiDraft draft(@Nullable String text, @Nullable MultipartFile image, AiEngine engine) {
		String recipe = text == null ? "" : text.strip();
		if (recipe.length() > MAX_TEXT_LENGTH) {
			throw new ApiException(ErrorCode.AI_TEXT_TOO_LONG);
		}
		Gemini.Image photo = image == null || image.isEmpty() ? null : photo(image);
		if (recipe.isEmpty() && photo == null) {
			throw new ApiException(ErrorCode.AI_INPUT_REQUIRED);
		}
		onlineAi.checkConfigured(engine);
		if (!oneAtATime.tryAcquire()) {
			throw new ApiException(ErrorCode.AI_BUSY);
		}
		try {
			RecipeAiReader.Known known = known();
			String answer = onlineAi.generate(engine, RecipeAiPrompt.INSTRUCTIONS,
					RecipeAiPrompt.message(recipe, known.categories().keySet(), known.tags().keySet(), known.ingredients()), photo,
					RecipeAiPrompt.schema());
			RecipeAiDraft draft = RecipeAiReader.read(jsonMapper.readTree(answer), known);
			if (draft == null) {
				throw new ApiException(ErrorCode.AI_NOT_A_RECIPE);
			}
			return draft;
		} catch (JacksonException e) {
			throw new ApiException(engine == AiEngine.CLAUDE ? ErrorCode.CLAUDE_BAD_RESPONSE : ErrorCode.AI_BAD_RESPONSE);
		} finally {
			oneAtATime.release();
		}
	}

	/** Same rules and same names of the site as Gemini: only who reads the recipe changes. */
	public RecipeAiLocalPrompt localPrompt() {
		RecipeAiReader.Known known = known();
		return new RecipeAiLocalPrompt(RecipeAiPrompt.localInstructions(jsonMapper.writeValueAsString(RecipeAiPrompt.schema())),
				RecipeAiPrompt.context(known.categories().keySet(), known.tags().keySet(), known.ingredients()));
	}

	/** Checked exactly as an answer of Gemini: nothing the model wrote is taken as it is. */
	public RecipeAiDraft localDraft(String answer) {
		try {
			RecipeAiDraft draft = RecipeAiReader.read(jsonMapper.readTree(jsonIn(answer)), known());
			if (draft == null) {
				throw new ApiException(ErrorCode.AI_NOT_A_RECIPE);
			}
			return draft;
		} catch (JacksonException e) {
			throw new ApiException(ErrorCode.AI_LOCAL_BAD_RESPONSE);
		}
	}

	/** The object in the answer: without a schema to force it, a model likes to put a code fence around. */
	static String jsonIn(String answer) {
		int start = answer.indexOf('{');
		int end = answer.lastIndexOf('}');
		if (start < 0 || end < start) {
			throw new ApiException(ErrorCode.AI_LOCAL_BAD_RESPONSE);
		}
		return answer.substring(start, end + 1);
	}

	/** JPEG or PNG, recognised from its content; sent as it is (10 MB at most, as the photos). */
	static Gemini.Image photo(MultipartFile image) {
		try {
			byte[] bytes = image.getBytes();
			return new Gemini.Image(bytes, ImageProcessor.mediaType(bytes));
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** The site's categories, tags and ingredients, for the AI to choose among and reuse. */
	private RecipeAiReader.Known known() {
		Map<String, Long> categories = categoryRepository.findAll(Sort.by("name"))
			.stream()
			.collect(Collectors.toMap(Category::getName, Category::getId, (first, second) -> first, LinkedHashMap::new));
		Map<String, Long> tags = tagRepository.findAll(Sort.by("name"))
			.stream()
			.collect(Collectors.toMap(Tag::getName, Tag::getId, (first, second) -> first, LinkedHashMap::new));
		List<String> ingredients = ingredientRepository.findAll(Sort.by("name")).stream().map(Ingredient::getName).toList();
		return new RecipeAiReader.Known(categories, tags, ingredients);
	}

}
