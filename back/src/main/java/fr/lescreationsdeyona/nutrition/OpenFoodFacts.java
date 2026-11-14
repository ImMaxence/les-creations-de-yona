package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Products of the shops (a biscuit, a bar of a brand…) and the values of their label, from Open Food Facts, the
 * open database of food products (ODbL): searched by name or by barcode for the back-office only, the values
 * then copied to the ingredient. Nothing of the site nor of its admins is sent, only what is searched.
 */
@Component
class OpenFoodFacts {

	private static final Logger log = LoggerFactory.getLogger(OpenFoodFacts.class);

	private static final String SEARCH = "https://search.openfoodfacts.org/search?page_size=20&langs=fr&fields="
			+ "code,product_name,product_name_fr,brands,quantity,nutriments&q=";

	private static final String PRODUCT = "https://world.openfoodfacts.org/api/v2/product/%s.json?fields="
			+ "code,product_name,product_name_fr,brands,quantity,nutriments";

	/** A barcode: EAN-8, UPC-A, EAN-13 or GTIN-14. */
	private static final Pattern BARCODE = Pattern.compile("\\d{8,14}");

	private static final Duration TIMEOUT = Duration.ofSeconds(8);

	/** Open Food Facts asks every program to say what it is. */
	private static final String USER_AGENT = "RecipeBackOffice/1.0 (nutrition facts of recipes)";

	static final int LIMIT = 10;

	private final JsonMapper jsonMapper;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

	OpenFoodFacts(JsonMapper jsonMapper) {
		this.jsonMapper = jsonMapper;
	}

	/** By name ("kinder bueno") or barcode ("3017626998106"); only the products whose label gives the energy. */
	List<OpenFoodFactsProduct> search(String query) {
		String cleaned = query.strip();
		if (BARCODE.matcher(cleaned).matches()) {
			JsonNode answer = get(URI.create(PRODUCT.formatted(cleaned)), true);
			OpenFoodFactsProduct product = answer == null ? null : product(answer.path("product"));
			return product == null ? List.of() : List.of(product);
		}
		JsonNode answer = get(URI.create(SEARCH + URLEncoder.encode(cleaned, StandardCharsets.UTF_8)), false);
		List<OpenFoodFactsProduct> products = new ArrayList<>();
		if (answer != null) {
			for (JsonNode hit : answer.path("hits")) {
				OpenFoodFactsProduct product = product(hit);
				if (product != null && products.size() < LIMIT) {
					products.add(product);
				}
			}
		}
		return products;
	}

	/** Null for a product unknown (404 on a barcode); refused when Open Food Facts does not answer. */
	private @Nullable JsonNode get(URI uri, boolean notFoundIsEmpty) {
		HttpRequest request = HttpRequest.newBuilder(uri).timeout(TIMEOUT).header("User-Agent", USER_AGENT)
			.header("Accept", "application/json").GET().build();
		try {
			HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (notFoundIsEmpty && response.statusCode() == 404) {
				return null;
			}
			if (response.statusCode() != 200) {
				log.warn("Open Food Facts answered {} to {}", response.statusCode(), uri.getPath());
				throw new ApiException(ErrorCode.OPEN_FOOD_FACTS_UNAVAILABLE);
			}
			return jsonMapper.readTree(response.body());
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new ApiException(ErrorCode.OPEN_FOOD_FACTS_UNAVAILABLE);
		}
		catch (IOException | RuntimeException ex) {
			if (ex instanceof ApiException apiException) {
				throw apiException;
			}
			log.warn("Open Food Facts unreachable", ex);
			throw new ApiException(ErrorCode.OPEN_FOOD_FACTS_UNAVAILABLE);
		}
	}

	/** Null without a name or without the energy per 100 g. */
	static @Nullable OpenFoodFactsProduct product(JsonNode node) {
		String name = text(node.path("product_name_fr"));
		if (name == null) {
			name = text(node.path("product_name"));
		}
		String code = text(node.path("code"));
		JsonNode nutriments = node.path("nutriments");
		Double kcal = per100g(nutriments, "energy-kcal");
		if (kcal == null) {
			Double kj = per100g(nutriments, "energy-kj");
			kcal = kj == null ? null : kj / NutritionFacts.KJ_PER_KCAL;
		}
		if (name == null || code == null || kcal == null) {
			return null;
		}
		double carbohydrates = grams(nutriments, "carbohydrates");
		double fat = grams(nutriments, "fat");
		Double salt = per100g(nutriments, "salt");
		if (salt == null) {
			Double sodium = per100g(nutriments, "sodium");
			salt = sodium == null ? 0 : sodium * 2.5;
		}
		NutritionLabel label = new NutritionLabel(decimal(Math.min(950, kcal), 1), decimal(grams(nutriments, "proteins"), 2),
				decimal(carbohydrates, 2), decimal(Math.min(carbohydrates, grams(nutriments, "sugars")), 2), decimal(fat, 2),
				decimal(Math.min(fat, grams(nutriments, "saturated-fat")), 2), decimal(grams(nutriments, "fiber"), 2),
				decimal(Math.min(100, salt), 2));
		return new OpenFoodFactsProduct(code, name, brands(node.path("brands")), text(node.path("quantity")), label);
	}

	/** The value per 100 g, or per 100 g once prepared when the label gives only that one. */
	private static @Nullable Double per100g(JsonNode nutriments, String nutrient) {
		for (String key : List.of(nutrient + "_100g", nutrient + "_prepared_100g")) {
			JsonNode value = nutriments.path(key);
			if (value.isNumber() && value.asDouble() >= 0) {
				return value.asDouble();
			}
		}
		return null;
	}

	private static double grams(JsonNode nutriments, String nutrient) {
		Double value = per100g(nutriments, nutrient);
		return value == null ? 0 : Math.min(100, value);
	}

	private static BigDecimal decimal(double value, int scale) {
		return BigDecimal.valueOf(Math.max(0, value)).setScale(scale, RoundingMode.HALF_UP);
	}

	/** "Kinder, Ferrero": a text, or a list of them. */
	private static @Nullable String brands(JsonNode brands) {
		if (brands.isArray()) {
			String joined = StreamSupport.stream(brands.spliterator(), false)
				.map(OpenFoodFacts::text)
				.filter(Objects::nonNull)
				.distinct()
				.collect(Collectors.joining(", "));
			return joined.isEmpty() ? null : joined;
		}
		return text(brands);
	}

	private static @Nullable String text(JsonNode node) {
		if (!node.isString() && !node.isNumber()) {
			return null;
		}
		String text = node.asString().strip();
		return text.isEmpty() ? null : text.length() > 200 ? text.substring(0, 200) : text;
	}

}
