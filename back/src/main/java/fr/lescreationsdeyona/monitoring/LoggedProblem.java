package fr.lescreationsdeyona.monitoring;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import org.jspecify.annotations.Nullable;

/**
 * An error or a warning, as caught: the backend's own (Logback), or a visitor's browser's. The same
 * problem again has the same {@code fingerprint}: it adds to the count of its line.
 */
public record LoggedProblem(String fingerprint, Level level, Source source, @Nullable String logger, String message,
		@Nullable String detail, @Nullable String page, Instant at) {

	public enum Level {
		ERROR, WARN
	}

	public enum Source {
		BACKEND, BROWSER
	}

	static final int MAX_MESSAGE = 2000;

	static final int MAX_DETAIL = 20_000;

	static final int MAX_PAGE = 500;

	static final int MAX_LOGGER = 300;

	/** Cut to the limits of the table. */
	static LoggedProblem of(Level level, Source source, @Nullable String logger, String message, @Nullable String detail,
			@Nullable String page, String sameAs, Instant at) {
		String text = cut(message.isBlank() ? "(sans message)" : message.strip(), MAX_MESSAGE);
		return new LoggedProblem(fingerprint(level + "|" + source + "|" + sameAs), level, source, cutOrNull(logger, MAX_LOGGER),
				text, cutOrNull(detail, MAX_DETAIL), cutOrNull(page, MAX_PAGE), at);
	}

	static String fingerprint(String sameAs) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sameAs.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	static String cut(String text, int max) {
		return text.length() <= max ? text : text.substring(0, max - 1) + "…";
	}

	static @Nullable String cutOrNull(@Nullable String text, int max) {
		return text == null || text.isBlank() ? null : cut(text.strip(), max);
	}

}
