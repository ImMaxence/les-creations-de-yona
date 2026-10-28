package fr.lescreationsdeyona.ai;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Google's Gemini API, called directly over HTTPS with the key of the free tier. Models are tried
 * in order: an overloaded one, or one out of its daily quota (each model has its own), hands over
 * to the next. Nothing is retried on the same model: the admin decides when to try again.
 */
@Component
class Gemini {

	private static final Logger log = LoggerFactory.getLogger(Gemini.class);

	private static final String MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

	/** Daily quotas start again at midnight, Pacific time. */
	private static final ZoneId QUOTA_ZONE = ZoneId.of("America/Los_Angeles");

	/** The answer was stopped for its content. */
	private static final Set<String> BLOCKED_REASONS = Set.of("SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII",
			"IMAGE_SAFETY");

	enum Failure {

		/** Unknown, revoked or restricted key: only a new key helps. */
		KEY_REFUSED,
		/** Every model has used its free requests of the day. */
		DAILY_QUOTA,
		/** Too many requests this minute. */
		RATE_LIMITED,
		/** Overloaded, down or too slow: a temporary state. */
		UNAVAILABLE,
		/** Refused for its content. */
		BLOCKED,
		/** An answer that is not the JSON asked for. */
		BAD_RESPONSE

	}

	static class GeminiException extends Exception {

		final Failure failure;

		GeminiException(Failure failure, String detail) {
			super(failure + ": " + detail);
			this.failure = failure;
		}

	}

	record Image(byte[] bytes, String mimeType) {
	}

	enum KeyCheck {
		VALID, REFUSED, UNKNOWN
	}

	private final GeminiProperties properties;

	private final JsonMapper jsonMapper;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

	/** Model to the time its daily quota starts again. */
	private final Map<String, Instant> exhaustedUntil = new ConcurrentHashMap<>();

	Gemini(GeminiProperties properties, JsonMapper jsonMapper) {
		this.properties = properties;
		this.jsonMapper = jsonMapper;
	}

	boolean configured() {
		return properties.configured();
	}

	/** Reads the description of the first model: uses no quota. */
	KeyCheck checkKey() {
		HttpRequest request = HttpRequest.newBuilder(URI.create(MODELS_URL + properties.models().getFirst()))
			.header("x-goog-api-key", properties.apiKey().strip())
			.timeout(Duration.ofSeconds(10))
			.GET()
			.build();
		try {
			HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() == 200) {
				return KeyCheck.VALID;
			}
			return classify(response.statusCode(), response.body()) == Failure.KEY_REFUSED ? KeyCheck.REFUSED : KeyCheck.UNKNOWN;
		} catch (IOException e) {
			return KeyCheck.UNKNOWN;
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			return KeyCheck.UNKNOWN;
		}
	}

	/** When every model is out of its daily quota: the time the first one starts again. */
	Optional<Instant> exhaustedUntil() {
		Instant now = Instant.now();
		List<Instant> times = new ArrayList<>();
		for (String model : properties.models()) {
			Instant until = exhaustedUntil.get(model);
			if (until == null || until.isBefore(now)) {
				return Optional.empty();
			}
			times.add(until);
		}
		return times.stream().min(Instant::compareTo);
	}

	/**
	 * The JSON answered by the first model able to answer, following {@code schema} (JSON Schema).
	 * {@code instructions}: the system instruction; {@code text} and {@code image}: what to read.
	 */
	String generate(String instructions, String text, @Nullable Image image, Map<String, Object> schema)
			throws GeminiException {
		String body = jsonMapper.writeValueAsString(requestBody(instructions, text, image, schema));
		GeminiException last = null;
		for (String model : properties.models()) {
			Instant until = exhaustedUntil.get(model);
			if (until != null && until.isAfter(Instant.now())) {
				continue;
			}
			try {
				return call(model, body);
			} catch (GeminiException e) {
				log.warn("Gemini {}: {}", model, e.getMessage());
				switch (e.failure) {
					case DAILY_QUOTA -> exhaustedUntil.put(model, nextQuotaReset());
					case RATE_LIMITED, UNAVAILABLE -> {
					}
					default -> throw e;
				}
				last = e;
			}
		}
		if (exhaustedUntil().isPresent()) {
			throw new GeminiException(Failure.DAILY_QUOTA, "every model is out of its daily quota");
		}
		// The last model tried says what happened; one out of its daily quota leaves the others
		throw last == null || last.failure == Failure.DAILY_QUOTA ? new GeminiException(Failure.UNAVAILABLE, "no model answered")
				: last;
	}

	private String call(String model, String body) throws GeminiException {
		HttpRequest request = HttpRequest.newBuilder(URI.create(MODELS_URL + model + ":generateContent"))
			.header("x-goog-api-key", properties.apiKey().strip())
			.header("Content-Type", "application/json")
			.timeout(properties.timeout())
			.POST(HttpRequest.BodyPublishers.ofString(body))
			.build();
		HttpResponse<String> response;
		try {
			response = http.send(request, HttpResponse.BodyHandlers.ofString());
		} catch (IOException e) {
			throw new GeminiException(Failure.UNAVAILABLE, e.toString());
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new GeminiException(Failure.UNAVAILABLE, "interrupted");
		}
		if (response.statusCode() != 200) {
			throw new GeminiException(classify(response.statusCode(), response.body()),
					"HTTP " + response.statusCode() + " " + abbreviate(response.body()));
		}
		return answerText(jsonMapper.readTree(response.body()));
	}

	/** The text of the first answer, its thoughts left out. */
	static String answerText(JsonNode response) throws GeminiException {
		JsonNode candidate = response.path("candidates").path(0);
		if (candidate.isMissingNode()) {
			String blockReason = response.path("promptFeedback").path("blockReason").asString("");
			throw new GeminiException(blockReason.isEmpty() ? Failure.BAD_RESPONSE : Failure.BLOCKED,
					"no answer " + blockReason);
		}
		String finishReason = candidate.path("finishReason").asString("");
		if (BLOCKED_REASONS.contains(finishReason)) {
			throw new GeminiException(Failure.BLOCKED, finishReason);
		}
		StringBuilder text = new StringBuilder();
		for (JsonNode part : candidate.path("content").path("parts")) {
			if (!part.path("thought").asBoolean(false)) {
				text.append(part.path("text").asString(""));
			}
		}
		if (text.isEmpty() || "MAX_TOKENS".equals(finishReason)) {
			throw new GeminiException(Failure.BAD_RESPONSE, "empty or cut answer " + finishReason);
		}
		return text.toString();
	}

	/**
	 * What an error answer means. A 404 is read as a model not served right now (a model withdrawn
	 * for new users, or Google's front answering an empty page under load): the next one is tried.
	 */
	static Failure classify(int status, String body) {
		String lower = body.toLowerCase(Locale.ROOT);
		boolean aboutKey = lower.contains("api_key") || lower.contains("api key");
		if (status == 401 || ((status == 400 || status == 403) && aboutKey)) {
			return Failure.KEY_REFUSED;
		}
		if (status == 429) {
			return lower.contains("perday") ? Failure.DAILY_QUOTA : Failure.RATE_LIMITED;
		}
		if (status == 403 || status == 404 || status == 408 || status >= 500) {
			return Failure.UNAVAILABLE;
		}
		return Failure.BAD_RESPONSE;
	}

	private static Map<String, Object> requestBody(String instructions, String text, @Nullable Image image,
			Map<String, Object> schema) {
		List<Map<String, Object>> parts = new ArrayList<>();
		parts.add(Map.of("text", text));
		if (image != null) {
			parts.add(Map.of("inlineData",
					Map.of("mimeType", image.mimeType(), "data", Base64.getEncoder().encodeToString(image.bytes()))));
		}
		return Map.of("systemInstruction", Map.of("parts", List.of(Map.of("text", instructions))), "contents",
				List.of(Map.of("role", "user", "parts", parts)), "generationConfig",
				Map.of("responseMimeType", "application/json", "responseJsonSchema", schema));
	}

	private static Instant nextQuotaReset() {
		return LocalDate.now(QUOTA_ZONE).plusDays(1).atStartOfDay(QUOTA_ZONE).toInstant();
	}

	private static String abbreviate(String body) {
		String flat = body.replaceAll("\\s+", " ");
		return flat.length() > 300 ? flat.substring(0, 300) + "…" : flat;
	}

}
