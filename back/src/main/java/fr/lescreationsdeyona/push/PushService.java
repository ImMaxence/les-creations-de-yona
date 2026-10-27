package fr.lescreationsdeyona.push;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.recipe.RecipePublished;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.json.JsonMapper;

/**
 * "Me prévenir des nouvelles recettes": browsers subscribe without any account, and receive a
 * notification when a recipe is published for the first time. Nothing about the visitor is kept,
 * only what the browser's push service needs.
 * <p>
 * The server only ever calls the push services of the browsers (Google, Mozilla, Apple, Microsoft):
 * any other address is refused, so that a subscription cannot make it call anything else.
 */
@Service
public class PushService {

	private static final Logger log = LoggerFactory.getLogger(PushService.class);

	/** Hosts of the push services, and their subdomains. */
	private static final Set<String> PUSH_SERVICES = Set.of("fcm.googleapis.com", "push.services.mozilla.com",
			"push.apple.com", "notify.windows.com");

	private static final int MAX_SUBSCRIPTIONS = 20_000;

	/** A notification nobody saw within a day is about an old recipe already. */
	private static final Duration TIME_TO_LIVE = Duration.ofDays(1);

	private static final Duration TIMEOUT = Duration.ofSeconds(15);

	private static final int MAX_BODY_LENGTH = 140;

	private final JdbcClient jdbc;

	private final WebPushKeys keys;

	private final JsonMapper jsonMapper;

	private final String subject;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

	/** One sending at a time, in the background: publishing does not wait for it. */
	private final ExecutorService sender = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("web-push").factory());

	PushService(JdbcClient jdbc, WebPushKeys keys, JsonMapper jsonMapper, @Value("${app.push.subject}") String subject) {
		this.jdbc = jdbc;
		this.keys = keys;
		this.jsonMapper = jsonMapper;
		this.subject = subject;
	}

	record Subscription(long id, String endpoint, String p256dh, String auth) {
	}

	/** Given to the browser when it subscribes (applicationServerKey). */
	public String publicKey() {
		return keys.get().publicKey();
	}

	/** Subscribing again (new keys after a browser update) replaces the previous keys. */
	public void subscribe(PushSubscriptionForm form) {
		requirePushService(form.endpoint());
		try {
			WebPushCrypto.decodePublicKey(WebPushCrypto.fromBase64Url(form.keys().p256dh()));
			if (WebPushCrypto.fromBase64Url(form.keys().auth()).length != 16) {
				throw new ApiException(ErrorCode.PUSH_SUBSCRIPTION_INVALID);
			}
		}
		catch (GeneralSecurityException | IllegalArgumentException ex) {
			throw new ApiException(ErrorCode.PUSH_SUBSCRIPTION_INVALID, ex);
		}
		if (count() >= MAX_SUBSCRIPTIONS) {
			throw new ApiException(ErrorCode.PUSH_SUBSCRIPTIONS_FULL);
		}
		jdbc.sql("""
				insert into push_subscription (endpoint, p256dh, auth, created_at) values (:endpoint, :p256dh, :auth, :now)
				on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth""")
			.param("endpoint", form.endpoint())
			.param("p256dh", form.keys().p256dh())
			.param("auth", form.keys().auth())
			.param("now", Timestamp.from(Instant.now()))
			.update();
	}

	/** Unknown addresses are ignored: the visitor may unsubscribe twice. */
	public void unsubscribe(String endpoint) {
		jdbc.sql("delete from push_subscription where endpoint = :endpoint").param("endpoint", endpoint).update();
	}

	public long count() {
		return jdbc.sql("select count(*) from push_subscription").query(Long.class).single();
	}

	/** Once the publication is committed: a rolled back save notifies nobody. */
	@TransactionalEventListener
	void onRecipePublished(RecipePublished recipe) {
		sender.execute(() -> notifyAll(recipe));
	}

	@PreDestroy
	void stop() {
		sender.shutdownNow();
	}

	private void notifyAll(RecipePublished recipe) {
		byte[] payload = jsonMapper.writeValueAsBytes(Map.of("notification", notification(recipe)));
		List<Subscription> subscriptions = jdbc.sql("select id, endpoint, p256dh, auth from push_subscription")
			.query(Subscription.class)
			.list();
		int delivered = 0;
		int expired = 0;
		for (Subscription subscription : subscriptions) {
			try {
				int status = send(subscription, payload);
				if (status / 100 == 2) {
					delivered++;
				}
				else if (status == 404 || status == 410) {
					// Unsubscribed in the browser, or expired: never valid again
					jdbc.sql("delete from push_subscription where id = :id").param("id", subscription.id()).update();
					expired++;
				}
				else {
					log.warn("Push service {} answered {}", URI.create(subscription.endpoint()).getHost(), status);
				}
			}
			catch (InterruptedException ex) {
				Thread.currentThread().interrupt();
				return;
			}
			catch (IOException | GeneralSecurityException | IllegalArgumentException ex) {
				log.warn("Notification to {} failed", URI.create(subscription.endpoint()).getHost(), ex);
			}
		}
		log.info("New recipe \"{}\" notified: {} delivered, {} expired subscriptions removed, {} in all", recipe.title(),
				delivered, expired, subscriptions.size());
	}

	/**
	 * Shown by Angular's service worker; a tap opens the recipe, in the site's window if one is
	 * open. Relative addresses are resolved against the site.
	 */
	private static Map<String, Object> notification(RecipePublished recipe) {
		String intro = recipe.intro() == null ? "" : recipe.intro().strip();
		Map<String, Object> notification = new LinkedHashMap<>();
		notification.put("title", "Nouvelle recette : " + recipe.title());
		notification.put("body", intro.isEmpty() ? "Elle vous attend sur Les créations de Yona"
				: intro.length() <= MAX_BODY_LENGTH ? intro : intro.substring(0, MAX_BODY_LENGTH - 1).strip() + "…");
		notification.put("icon", "/icons/icon-192.png");
		if (recipe.imageId() != null) {
			notification.put("image", "/api/images/" + recipe.imageId() + "/800.webp");
		}
		notification.put("lang", "fr");
		notification.put("data", Map.of("onActionClick",
				Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", recipe.path()))));
		return notification;
	}

	private int send(Subscription subscription, byte[] payload)
			throws IOException, InterruptedException, GeneralSecurityException {
		URI endpoint = URI.create(subscription.endpoint());
		WebPushKeys.Keys vapid = keys.get();
		String token = WebPushCrypto.vapidToken(endpoint.getScheme() + "://" + endpoint.getHost(), subject,
				Instant.now().plus(Duration.ofHours(12)).getEpochSecond(), vapid.privateKey());
		byte[] body = WebPushCrypto.encrypt(payload, WebPushCrypto.fromBase64Url(subscription.p256dh()),
				WebPushCrypto.fromBase64Url(subscription.auth()));
		HttpRequest request = HttpRequest.newBuilder(endpoint)
			.timeout(TIMEOUT)
			.header("Authorization", "vapid t=" + token + ", k=" + vapid.publicKey())
			.header("Content-Encoding", "aes128gcm")
			.header("Content-Type", "application/octet-stream")
			.header("TTL", String.valueOf(TIME_TO_LIVE.toSeconds()))
			.header("Urgency", "normal")
			.POST(HttpRequest.BodyPublishers.ofByteArray(body))
			.build();
		return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
	}

	private static void requirePushService(String endpoint) {
		URI uri;
		try {
			uri = URI.create(endpoint);
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(ErrorCode.PUSH_SUBSCRIPTION_INVALID, ex);
		}
		String host = uri.getHost();
		boolean known = host != null && PUSH_SERVICES.stream()
			.anyMatch(service -> host.equals(service) || host.endsWith("." + service));
		if (!"https".equals(uri.getScheme()) || !known || uri.getUserInfo() != null
				|| (uri.getPort() != -1 && uri.getPort() != 443)) {
			throw new ApiException(ErrorCode.PUSH_SUBSCRIPTION_INVALID);
		}
	}

}
