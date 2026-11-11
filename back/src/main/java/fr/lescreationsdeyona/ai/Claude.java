package fr.lescreationsdeyona.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.BadRequestException;
import com.anthropic.errors.InternalServerException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Claude, through Anthropic's official SDK. The answer follows the JSON Schema given (structured
 * outputs). Nothing is retried: the admin decides when to try again, as with Gemini. With the models
 * that have it, a request Claude declines is handed by Anthropic to another model ("fallbacks":
 * "default") rather than lost; Haiku has no such fallback, its refusal is shown.
 */
@Component
class Claude {

	private static final Logger log = LoggerFactory.getLogger(Claude.class);

	/** Long enough for the longest recipe, or an article of 12 blocks. */
	private static final long MAX_TOKENS = 16_000;

	private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";

	/** The models Anthropic can hand a declined request to another from: Haiku cannot. */
	private static final List<String> WITH_FALLBACKS = List.of("claude-fable-5", "claude-mythos-5", "claude-opus-5", "claude-sonnet-5-5");

	enum Failure {

		/** Unknown, revoked or disabled key. */
		KEY_REFUSED,
		/** No credit left on the account. */
		NO_CREDIT,
		/** Too many requests this minute. */
		RATE_LIMITED,
		/** Overloaded, down or too slow: a temporary state. */
		UNAVAILABLE,
		/** Declined for its content. */
		REFUSED,
		/** An answer that is not the JSON asked for. */
		BAD_RESPONSE

	}

	static class ClaudeException extends Exception {

		final Failure failure;

		ClaudeException(Failure failure, String detail) {
			super(failure + ": " + detail);
			this.failure = failure;
		}

	}

	private final ClaudeProperties properties;

	private volatile @Nullable AnthropicClient client;

	Claude(ClaudeProperties properties) {
		this.properties = properties;
	}

	boolean configured() {
		return properties.configured();
	}

	String model() {
		return properties.model();
	}

	/**
	 * The JSON answered, following {@code schema} (JSON Schema). {@code instructions}: the system
	 * prompt; {@code text} and {@code image}: what to read.
	 */
	String generate(String instructions, String text, Gemini.@Nullable Image image, Map<String, Object> schema)
			throws ClaudeException {
		List<ContentBlockParam> content = new ArrayList<>();
		if (image != null) {
			content.add(ContentBlockParam.ofImage(ImageBlockParam.builder()
				.source(Base64ImageSource.builder()
					.data(Base64.getEncoder().encodeToString(image.bytes()))
					.mediaType(Base64ImageSource.MediaType.of(image.mimeType()))
					.build())
				.build()));
		}
		content.add(ContentBlockParam.ofText(TextBlockParam.builder().text(text).build()));
		JsonOutputFormat.Schema.Builder strictSchema = JsonOutputFormat.Schema.builder();
		strict(schema).forEach((name, value) -> strictSchema.putAdditionalProperty(name, JsonValue.from(value)));
		MessageCreateParams.Builder request = MessageCreateParams.builder()
			.model(properties.model())
			.maxTokens(MAX_TOKENS)
			.system(instructions)
			.addUserMessageOfContentBlockParams(content)
			.outputConfig(OutputConfig.builder()
				.effort(OutputConfig.Effort.MEDIUM)
				.format(JsonOutputFormat.builder().schema(strictSchema.build()).build())
				.build());
		if (hasFallbacks(properties.model())) {
			request.putAdditionalHeader("anthropic-beta", FALLBACK_BETA)
				.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
		}
		MessageCreateParams params = request.build();
		Message message;
		try {
			message = client().messages().create(params);
		} catch (UnauthorizedException | PermissionDeniedException e) {
			throw failed(Failure.KEY_REFUSED, e);
		} catch (RateLimitException e) {
			throw failed(Failure.RATE_LIMITED, e);
		} catch (InternalServerException e) {
			throw failed(Failure.UNAVAILABLE, e);
		} catch (BadRequestException e) {
			throw failed(String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT).contains("credit") ? Failure.NO_CREDIT : Failure.BAD_RESPONSE, e);
		} catch (AnthropicServiceException e) {
			throw failed(classify(e.statusCode()), e);
		} catch (AnthropicIoException e) {
			throw failed(Failure.UNAVAILABLE, e);
		}
		StopReason stop = message.stopReason().orElse(null);
		if (StopReason.REFUSAL.equals(stop)) {
			throw new ClaudeException(Failure.REFUSED, "refusal");
		}
		if (StopReason.MAX_TOKENS.equals(stop)) {
			throw new ClaudeException(Failure.BAD_RESPONSE, "cut answer");
		}
		StringBuilder answer = new StringBuilder();
		message.content().forEach(block -> block.text().ifPresent(written -> answer.append(written.text())));
		if (answer.isEmpty()) {
			throw new ClaudeException(Failure.BAD_RESPONSE, "empty answer");
		}
		return answer.toString();
	}

	/** Whether Anthropic can hand a declined request to another model: not for Haiku. */
	static boolean hasFallbacks(String model) {
		return WITH_FALLBACKS.stream().anyMatch(model::startsWith);
	}

	/** 402: no credit; 529 and the like: overloaded. */
	static Failure classify(int status) {
		if (status == 401 || status == 403) {
			return Failure.KEY_REFUSED;
		}
		if (status == 402) {
			return Failure.NO_CREDIT;
		}
		if (status == 429) {
			return Failure.RATE_LIMITED;
		}
		if (status == 408 || status >= 500) {
			return Failure.UNAVAILABLE;
		}
		return Failure.BAD_RESPONSE;
	}

	private ClaudeException failed(Failure failure, Exception cause) {
		log.warn("Claude {}: {} {}", properties.model(), failure, cause.getMessage());
		return new ClaudeException(failure, String.valueOf(cause.getMessage()));
	}

	/**
	 * The schema as structured outputs want it: every object closed ("additionalProperties": false),
	 * and a nullable type ["string", "null"] written as anyOf.
	 */
	@SuppressWarnings("unchecked")
	static Map<String, Object> strict(Map<String, Object> schema) {
		Map<String, Object> copy = new LinkedHashMap<>();
		schema.forEach((key, value) -> {
			if (value instanceof Map<?, ?> map) {
				copy.put(key, "properties".equals(key) ? properties((Map<String, Object>) map) : strict((Map<String, Object>) map));
			} else {
				copy.put(key, value);
			}
		});
		if (copy.get("type") instanceof List<?> types && types.contains("null") && types.size() == 2) {
			Object type = types.get(0).equals("null") ? types.get(1) : types.get(0);
			copy.put("type", type);
			Map<String, Object> notNull = strict(copy);
			return Map.of("anyOf", List.of(notNull, Map.of("type", "null")));
		}
		if ("object".equals(copy.get("type"))) {
			copy.put("additionalProperties", false);
		}
		return copy;
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> properties(Map<String, Object> properties) {
		Map<String, Object> copy = new LinkedHashMap<>();
		properties.forEach((name, value) -> copy.put(name, strict((Map<String, Object>) value)));
		return copy;
	}

	private AnthropicClient client() {
		AnthropicClient current = client;
		if (current == null) {
			synchronized (this) {
				current = client;
				if (current == null) {
					current = AnthropicOkHttpClient.builder()
						.apiKey(String.valueOf(properties.apiKey()).strip())
						.timeout(properties.timeout())
						.maxRetries(0)
						.build();
					client = current;
				}
			}
		}
		return current;
	}

}
