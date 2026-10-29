package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.recipe.MoldShape;
import fr.lescreationsdeyona.recipe.RecipeForm;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * Gemini's answer turned into a draft for the editor. Nothing it says is trusted: lengths, counts
 * and ranges are those of {@link RecipeForm}, what does not fit is cut or left out, categories and
 * tags not on the site are dropped, and a known ingredient keeps the site's spelling.
 */
final class RecipeAiReader {

	private static final int MAX_MINUTES = 100_000;

	private RecipeAiReader() {
	}

	/** Names of the site to their id, or to their own spelling (ingredients). */
	record Known(Map<String, Long> categories, Map<String, Long> tags, List<String> ingredients) {
	}

	/** Null when the answer holds no recipe (no ingredient and no step, or said so). */
	static @Nullable RecipeAiDraft read(JsonNode answer, Known known) {
		if (!answer.path("isRecipe").asBoolean(true)) {
			return null;
		}
		Map<String, String> ingredientNames = new HashMap<>();
		known.ingredients().forEach(name -> ingredientNames.putIfAbsent(Texts.foldCaseAndAccents(name), name));
		List<RecipeForm.Part> parts = new ArrayList<>();
		for (JsonNode part : limit(answer.path("parts"), 10)) {
			RecipeForm.Part read = part(part, ingredientNames);
			if (!read.ingredients().isEmpty() || !read.steps().isEmpty()) {
				parts.add(read);
			}
		}
		if (parts.isEmpty()) {
			return null;
		}
		if (parts.size() == 1 && parts.getFirst().title() != null) {
			// A single part is a recipe without parts: its title would only repeat the recipe's
			RecipeForm.Part single = parts.getFirst();
			parts.set(0, new RecipeForm.Part(null, single.ingredients(), single.steps()));
		}
		return new RecipeAiDraft(theme(answer.path("theme")), text(answer.path("title"), 150), text(answer.path("intro"), 1000),
				count(answer.path("servings"), 1000), count(answer.path("prepMinutes"), MAX_MINUTES),
				count(answer.path("cookMinutes"), MAX_MINUTES), count(answer.path("restMinutes"), MAX_MINUTES),
				difficulty(answer.path("difficulty")), text(answer.path("tip"), 2000), equipment(answer.path("equipment")),
				mold(answer.path("mold")), ids(answer.path("categories"), known.categories(), 10),
				ids(answer.path("tags"), known.tags(), 20), parts);
	}

	/**
	 * Its ingredients, each once (case and accents ignored), and its steps; the positions of a
	 * step's ingredients follow the lines kept.
	 */
	private static RecipeForm.Part part(JsonNode part, Map<String, String> ingredientNames) {
		List<RecipeForm.IngredientLine> lines = new ArrayList<>();
		Map<String, Integer> positionByName = new HashMap<>();
		Map<Integer, Integer> positions = new HashMap<>();
		int index = 0;
		for (JsonNode line : limit(part.path("ingredients"), 100)) {
			int answered = index++;
			String name = text(line.path("name"), 100);
			if (name == null) {
				continue;
			}
			String key = Texts.foldCaseAndAccents(name);
			Integer kept = positionByName.get(key);
			if (kept == null) {
				kept = lines.size();
				positionByName.put(key, kept);
				lines.add(new RecipeForm.IngredientLine(ingredientNames.getOrDefault(key, Texts.capitalizeFirstLetter(name)),
						quantity(line.path("quantity")), text(line.path("unit"), 30), text(line.path("note"), 200)));
			}
			positions.put(answered, kept);
		}
		List<RecipeForm.Step> steps = new ArrayList<>();
		for (JsonNode step : limit(part.path("steps"), 100)) {
			String description = text(step.path("description"), 5000);
			if (description == null) {
				continue;
			}
			Set<Integer> used = new LinkedHashSet<>();
			for (JsonNode position : step.path("ingredientPositions")) {
				Integer kept = position.isIntegralNumber() ? positions.get(position.asInt()) : null;
				if (kept != null) {
					used.add(kept);
				}
			}
			steps.add(new RecipeForm.Step(description, count(step.path("durationMinutes"), MAX_MINUTES), List.copyOf(used)));
		}
		return new RecipeForm.Part(text(part.path("title"), 100), lines, steps);
	}

	private static List<JsonNode> limit(JsonNode array, int max) {
		List<JsonNode> items = new ArrayList<>();
		for (JsonNode item : array) {
			if (items.size() == max) {
				break;
			}
			items.add(item);
		}
		return items;
	}

	/** Trimmed and cut to its limit; blank as null. */
	private static @Nullable String text(JsonNode node, int max) {
		if (!node.isString()) {
			return null;
		}
		String text = node.asString().strip();
		if (text.isEmpty()) {
			return null;
		}
		return text.length() > max ? text.substring(0, max).strip() : text;
	}

	/** Above 0 and below {@code max}; 0 or nonsense as null. */
	private static @Nullable Integer count(JsonNode node, int max) {
		if (!node.isNumber()) {
			return null;
		}
		long value = Math.round(node.asDouble());
		return value > 0 && value < max ? (int) value : null;
	}

	/** Two decimals at most, as the form: 1/3 becomes 0.33. */
	private static @Nullable BigDecimal quantity(JsonNode node) {
		if (!node.isNumber() || node.asDouble() <= 0) {
			return null;
		}
		BigDecimal quantity = BigDecimal.valueOf(node.asDouble()).setScale(2, RoundingMode.HALF_UP).stripTrailingZeros();
		if (quantity.scale() < 0) {
			// 100, not 1E+2
			quantity = quantity.setScale(0);
		}
		return quantity.signum() > 0 && quantity.compareTo(BigDecimal.valueOf(1_000_000)) < 0 ? quantity : null;
	}

	/** Sweet or savory, as the model saw it; null for anything else, the editor's choice then stays. */
	private static @Nullable RecipeTheme theme(JsonNode node) {
		String theme = node.asString("");
		return "SWEET".equals(theme) ? RecipeTheme.SWEET : "SAVORY".equals(theme) ? RecipeTheme.SAVORY : null;
	}

	/** From 1 to 5, rounded to the nearest half point. */
	private static @Nullable BigDecimal difficulty(JsonNode node) {
		if (!node.isNumber()) {
			return null;
		}
		double halves = Math.round(Math.clamp(node.asDouble(), 1, 5) * 2);
		return BigDecimal.valueOf(halves / 2).setScale(1, RoundingMode.UNNECESSARY);
	}

	private static List<String> equipment(JsonNode array) {
		Map<String, String> items = new LinkedHashMap<>();
		for (JsonNode item : array) {
			String text = text(item, 100);
			if (text != null && items.size() < 30) {
				items.putIfAbsent(Texts.foldCaseAndAccents(text), Texts.capitalizeFirstLetter(text));
			}
		}
		return List.copyOf(items.values());
	}

	/** In centimeters, to the millimeter; a rectangle needs both sides. */
	private static RecipeForm.@Nullable Mold mold(JsonNode mold) {
		MoldShape shape;
		try {
			shape = MoldShape.valueOf(mold.path("shape").asString(""));
		} catch (IllegalArgumentException e) {
			return null;
		}
		BigDecimal length = centimeters(mold.path("lengthCm"));
		BigDecimal width = shape == MoldShape.RECTANGLE ? centimeters(mold.path("widthCm")) : null;
		if (length == null || (shape == MoldShape.RECTANGLE && width == null)) {
			return null;
		}
		return new RecipeForm.Mold(shape, length, width);
	}

	private static @Nullable BigDecimal centimeters(JsonNode node) {
		if (!node.isNumber() || node.asDouble() < 1 || node.asDouble() > 200) {
			return null;
		}
		return BigDecimal.valueOf(node.asDouble()).setScale(1, RoundingMode.HALF_UP);
	}

	/** The site's own, each once, in the order given. */
	private static List<Long> ids(JsonNode names, Map<String, Long> known, int max) {
		Map<String, Long> byFolded = new HashMap<>();
		known.forEach((name, id) -> byFolded.put(Texts.foldCaseAndAccents(name), id));
		Set<Long> ids = new LinkedHashSet<>();
		for (JsonNode name : names) {
			Long id = name.isString() ? byFolded.get(Texts.foldCaseAndAccents(name.asString().strip())) : null;
			if (id != null && ids.size() < max) {
				ids.add(id);
			}
		}
		return List.copyOf(ids);
	}

}
