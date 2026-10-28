package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.ai.Gemini.GeminiException;
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
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Semaphore;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * "Remplir avec l'IA": a pasted recipe, or the photo of one, read by Gemini into a draft for the
 * editor. Nothing is saved; the admin checks it and saves as usual. Gemini is called outside any
 * transaction, one recipe at a time: it takes a few seconds, sometimes half a minute.
 */
@Service
public class RecipeAiService {

	static final int MAX_TEXT_LENGTH = 20_000;

	/** A refused key is checked again after that, in case it was fixed. */
	private static final Duration KEY_CHECK_VALIDITY = Duration.ofMinutes(10);

	private final Gemini gemini;

	private final JsonMapper jsonMapper;

	private final CategoryRepository categoryRepository;

	private final TagRepository tagRepository;

	private final IngredientRepository ingredientRepository;

	private final Semaphore oneAtATime = new Semaphore(1);

	private volatile boolean keyRefused;

	private volatile @Nullable Instant keyCheckedAt;

	RecipeAiService(Gemini gemini, JsonMapper jsonMapper, CategoryRepository categoryRepository, TagRepository tagRepository,
			IngredientRepository ingredientRepository) {
		this.gemini = gemini;
		this.jsonMapper = jsonMapper;
		this.categoryRepository = categoryRepository;
		this.tagRepository = tagRepository;
		this.ingredientRepository = ingredientRepository;
	}

	/** Asked when the editor opens: greys the button out when it cannot work at all. */
	public RecipeAiStatus status() {
		if (!gemini.configured()) {
			return new RecipeAiStatus(false, ErrorCode.AI_NOT_CONFIGURED.message(), null);
		}
		Instant checkedAt = keyCheckedAt;
		if (checkedAt == null || checkedAt.plus(KEY_CHECK_VALIDITY).isBefore(Instant.now())) {
			Gemini.KeyCheck check = gemini.checkKey();
			// Google not answering says nothing about the key: the button stays usable
			if (check != Gemini.KeyCheck.UNKNOWN) {
				keyRefused = check == Gemini.KeyCheck.REFUSED;
				keyCheckedAt = Instant.now();
			}
		}
		if (keyRefused) {
			return new RecipeAiStatus(false, ErrorCode.AI_KEY_REFUSED.message(), null);
		}
		Optional<Instant> exhaustedUntil = gemini.exhaustedUntil();
		return exhaustedUntil
			.map(until -> new RecipeAiStatus(false, ErrorCode.AI_DAILY_QUOTA.message(), until))
			.orElseGet(() -> new RecipeAiStatus(true, null, null));
	}

	public RecipeAiDraft draft(@Nullable String text, @Nullable MultipartFile image) {
		String recipe = text == null ? "" : text.strip();
		if (recipe.length() > MAX_TEXT_LENGTH) {
			throw new ApiException(ErrorCode.AI_TEXT_TOO_LONG);
		}
		Gemini.Image photo = image == null || image.isEmpty() ? null : photo(image);
		if (recipe.isEmpty() && photo == null) {
			throw new ApiException(ErrorCode.AI_INPUT_REQUIRED);
		}
		if (!gemini.configured()) {
			throw new ApiException(ErrorCode.AI_NOT_CONFIGURED);
		}
		if (!oneAtATime.tryAcquire()) {
			throw new ApiException(ErrorCode.AI_BUSY);
		}
		try {
			RecipeAiReader.Known known = known();
			String answer = gemini.generate(RecipeAiPrompt.INSTRUCTIONS,
					RecipeAiPrompt.message(recipe, known.categories().keySet(), known.tags().keySet(), known.ingredients()), photo,
					RecipeAiPrompt.schema());
			RecipeAiDraft draft = RecipeAiReader.read(jsonMapper.readTree(answer), known);
			if (draft == null) {
				throw new ApiException(ErrorCode.AI_NOT_A_RECIPE);
			}
			return draft;
		} catch (GeminiException e) {
			if (e.failure == Gemini.Failure.KEY_REFUSED) {
				keyRefused = true;
				keyCheckedAt = Instant.now();
			}
			throw new ApiException(errorCode(e.failure));
		} catch (JacksonException e) {
			throw new ApiException(ErrorCode.AI_BAD_RESPONSE);
		} finally {
			oneAtATime.release();
		}
	}

	static ErrorCode errorCode(Gemini.Failure failure) {
		return switch (failure) {
			case KEY_REFUSED -> ErrorCode.AI_KEY_REFUSED;
			case DAILY_QUOTA -> ErrorCode.AI_DAILY_QUOTA;
			case RATE_LIMITED -> ErrorCode.AI_RATE_LIMITED;
			case UNAVAILABLE -> ErrorCode.AI_UNAVAILABLE;
			case BLOCKED -> ErrorCode.AI_BLOCKED;
			case BAD_RESPONSE -> ErrorCode.AI_BAD_RESPONSE;
		};
	}

	/** JPEG or PNG, recognised from its content; sent as it is (10 MB at most, as the photos). */
	private static Gemini.Image photo(MultipartFile image) {
		try {
			byte[] bytes = image.getBytes();
			return new Gemini.Image(bytes, ImageProcessor.mediaType(bytes));
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** The site's categories, tags and ingredients, for Gemini to choose among and reuse. */
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
