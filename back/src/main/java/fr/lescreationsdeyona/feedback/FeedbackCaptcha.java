package fr.lescreationsdeyona.feedback;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * "Je ne suis pas un robot", without a third-party service, cookie or personal data. Ticking the
 * box makes the browser search for a number: hashed after the signed challenge, it must start with
 * {@link #DIFFICULTY} zero bits. A moment for one message, a real cost for a script sending many,
 * and a script that does not run the page never gets through. A challenge serves once.
 */
@Component
class FeedbackCaptcha {

	/** About 16,000 hashes to try: a second or two on a phone. */
	static final int DIFFICULTY = 14;

	/** Long enough to tick the box first and write the message afterwards. */
	static final Duration VALID = Duration.ofMinutes(30);

	/** Beyond it the memory is emptied: the limits by address and for the whole site still hold. */
	static final int MAX_USED = 5_000;

	private static final int MAX_TOKEN_LENGTH = 200;

	private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();

	private final SecureRandom random = new SecureRandom();

	/** Drawn at startup: a restart only asks the visitors who ticked the box to tick it again. */
	private final byte[] key = random.generateSeed(32);

	/** Challenges already used, with the moment they expire. */
	private final Map<String, Instant> used = new ConcurrentHashMap<>();

	FeedbackChallenge challenge(Instant now) {
		byte[] salt = new byte[16];
		random.nextBytes(salt);
		String content = now.plus(VALID).getEpochSecond() + "." + BASE64.encodeToString(salt);
		return new FeedbackChallenge(content + "." + sign(content), DIFFICULTY);
	}

	/** Signed here, still valid, solved, and never used before. */
	boolean accepts(@Nullable String token, @Nullable String solution, Instant now) {
		if (token == null || solution == null || token.length() > MAX_TOKEN_LENGTH) {
			return false;
		}
		int signature = token.lastIndexOf('.');
		int expiry = token.indexOf('.');
		if (expiry <= 0 || signature == expiry) {
			return false;
		}
		String content = token.substring(0, signature);
		if (!MessageDigest.isEqual(ascii(sign(content)), ascii(token.substring(signature + 1)))) {
			return false;
		}
		// Signed here: the date is one of ours
		Instant expires = Instant.ofEpochSecond(Long.parseLong(token.substring(0, expiry)));
		if (now.isAfter(expires) || leadingZeroBits(sha256(token + ":" + solution)) < DIFFICULTY) {
			return false;
		}
		used.values().removeIf(time -> now.isAfter(time));
		if (used.size() >= MAX_USED) {
			used.clear();
		}
		return used.putIfAbsent(token, expires) == null;
	}

	static int leadingZeroBits(byte[] hash) {
		int bits = 0;
		for (byte value : hash) {
			if (value != 0) {
				return bits + Integer.numberOfLeadingZeros(value & 0xff) - 24;
			}
			bits += 8;
		}
		return bits;
	}

	static byte[] sha256(String text) {
		try {
			return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private String sign(String content) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(key, "HmacSHA256"));
			return BASE64.encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static byte[] ascii(String text) {
		return text.getBytes(StandardCharsets.US_ASCII);
	}

}
