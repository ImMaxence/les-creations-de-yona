package fr.lescreationsdeyona.feedback;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Asks Google whether the visitor passed "Je ne suis pas un robot" (reCAPTCHA v2 checkbox). Refused
 * when Google cannot answer: without a check, the form would be open to robots.
 */
@Component
class Recaptcha {

	private static final Logger log = LoggerFactory.getLogger(Recaptcha.class);

	private static final URI VERIFY = URI.create("https://www.google.com/recaptcha/api/siteverify");

	private static final Duration TIMEOUT = Duration.ofSeconds(8);

	private final String siteKey;

	private final String secretKey;

	private final JsonMapper jsonMapper;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

	Recaptcha(@Value("${app.recaptcha.site-key}") String siteKey, @Value("${app.recaptcha.secret-key}") String secretKey,
			JsonMapper jsonMapper) {
		this.siteKey = siteKey;
		this.secretKey = secretKey;
		this.jsonMapper = jsonMapper;
	}

	String siteKey() {
		return siteKey;
	}

	boolean accepts(String token) {
		HttpRequest request = HttpRequest.newBuilder(VERIFY)
			.timeout(TIMEOUT)
			.header("Content-Type", "application/x-www-form-urlencoded")
			.POST(HttpRequest.BodyPublishers.ofString("secret=" + encoded(secretKey) + "&response=" + encoded(token)))
			.build();
		try {
			return successful(http.send(request, HttpResponse.BodyHandlers.ofString()).body());
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			return false;
		}
		catch (IOException ex) {
			log.warn("reCAPTCHA unreachable, message refused", ex);
			return false;
		}
	}

	boolean successful(String body) {
		try {
			JsonNode answer = jsonMapper.readTree(body);
			if (answer.path("success").asBoolean(false)) {
				return true;
			}
			if (answer.path("error-codes").toString().contains("secret")) {
				log.error("reCAPTCHA refuses the secret key: check RECAPTCHA_SECRET_KEY");
			}
			return false;
		}
		catch (RuntimeException ex) {
			log.warn("Unreadable answer from reCAPTCHA, message refused", ex);
			return false;
		}
	}

	private static String encoded(String value) {
		return URLEncoder.encode(value, StandardCharsets.UTF_8);
	}

}
