package fr.lescreationsdeyona.push;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.recipe.RecipePublished;
import fr.lescreationsdeyona.shop.OrderReceived;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
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
 * <p>
 * A script cannot fill the table with forged subscriptions either: an address subscribes
 * {@link #PER_HOUR} browsers an hour at most, the whole site {@link #SITE_PER_HOUR} (remembered in
 * memory only, never written), and a subscription its push service refuses
 * {@link #MAX_FAILURES} times in a row is removed.
 */
@Service
public class PushService {

	private static final Logger log = LoggerFactory.getLogger(PushService.class);

	/** Hosts of the push services, and their subdomains. */
	private static final Set<String> PUSH_SERVICES = Set.of("fcm.googleapis.com", "push.services.mozilla.com",
			"push.apple.com", "notify.windows.com");

	private static final int MAX_SUBSCRIPTIONS = 20_000;

	/** New subscriptions from an address: a visitor with a few devices behind the same box. */
	static final int PER_HOUR = 10;

	/** New subscriptions for the whole site: many addresses (a botnet) cannot fill the table either. */
	static final int SITE_PER_HOUR = 300;

	/** Sendings refused in a row (400, 403…) before a subscription is removed: forged, or no longer ours. */
	static final int MAX_FAILURES = 3;

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

	/** Times of the last new subscriptions, by address: forgotten after an hour. */
	private final Map<String, Deque<Instant>> subscribedBy = new ConcurrentHashMap<>();

	/** Times of the last new subscriptions, all addresses together. */
	private final Deque<Instant> subscribedBySite = new ArrayDeque<>();

	PushService(JdbcClient jdbc, WebPushKeys keys, JsonMapper jsonMapper, @Value("${app.push.subject}") String subject) {
		this.jdbc = jdbc;
		this.keys = keys;
		this.jsonMapper = jsonMapper;
		this.subject = subject;
	}

	record Subscription(long id, String endpoint, String p256dh, String auth, int failures) {
	}

	/** Given to the browser when it subscribes (applicationServerKey). */
	public String publicKey() {
		return keys.get().publicKey();
	}

	/**
	 * Subscribing again (new keys after a browser update) replaces the previous keys, and is not
	 * counted against the sender's limit.
	 */
	public void subscribe(PushSubscriptionForm form, String sender) {
		checkSubscription(form);
		boolean known = jdbc.sql("select count(*) from push_subscription where endpoint = :endpoint")
			.param("endpoint", form.endpoint())
			.query(Long.class)
			.single() > 0;
		if (!known) {
			if (jdbc.sql("select count(*) from push_subscription").query(Long.class).single() >= MAX_SUBSCRIPTIONS) {
				throw new ApiException(ErrorCode.PUSH_SUBSCRIPTIONS_FULL);
			}
			ErrorCode refused = refusal(sender, Instant.now());
			if (refused != null) {
				throw new ApiException(refused);
			}
		}
		jdbc.sql("""
				insert into push_subscription (endpoint, p256dh, auth, created_at) values (:endpoint, :p256dh, :auth, :now)
				on conflict (endpoint) do update
				set p256dh = excluded.p256dh, auth = excluded.auth, failures = 0, new_recipes = true""")
			.param("endpoint", form.endpoint())
			.param("p256dh", form.keys().p256dh())
			.param("auth", form.keys().auth())
			.param("now", Timestamp.from(Instant.now()))
			.update();
	}

	/**
	 * Unknown addresses are ignored: the visitor may unsubscribe twice. A device an admin also gets
	 * the orders on stays subscribed to those.
	 */
	public void unsubscribe(String endpoint) {
		jdbc.sql("delete from push_subscription where endpoint = :endpoint and not admin_orders").param("endpoint", endpoint).update();
		jdbc.sql("update push_subscription set new_recipes = false where endpoint = :endpoint").param("endpoint", endpoint).update();
	}

	/** This device of an admin is told of each new order; new recipes only if it asked for them too. */
	public void subscribeToOrders(PushSubscriptionForm form) {
		checkSubscription(form);
		jdbc.sql("""
				insert into push_subscription (endpoint, p256dh, auth, created_at, new_recipes, admin_orders)
				values (:endpoint, :p256dh, :auth, :now, false, true)
				on conflict (endpoint) do update
				set p256dh = excluded.p256dh, auth = excluded.auth, failures = 0, admin_orders = true""")
			.param("endpoint", form.endpoint())
			.param("p256dh", form.keys().p256dh())
			.param("auth", form.keys().auth())
			.param("now", Timestamp.from(Instant.now()))
			.update();
	}

	public void unsubscribeFromOrders(String endpoint) {
		jdbc.sql("delete from push_subscription where endpoint = :endpoint and not new_recipes").param("endpoint", endpoint).update();
		jdbc.sql("update push_subscription set admin_orders = false where endpoint = :endpoint").param("endpoint", endpoint).update();
	}

	public boolean receivesOrders(String endpoint) {
		return jdbc.sql("select count(*) from push_subscription where endpoint = :endpoint and admin_orders")
			.param("endpoint", endpoint)
			.query(Long.class)
			.single() > 0;
	}

	/** Visitors subscribed to new recipes. */
	public long count() {
		return jdbc.sql("select count(*) from push_subscription where new_recipes").query(Long.class).single();
	}

	/** Once the publication is committed: a rolled back save notifies nobody. */
	@TransactionalEventListener
	void onRecipePublished(RecipePublished recipe) {
		sender.execute(() -> notifyRecipe(recipe));
	}

	/** Once the order is committed. */
	@TransactionalEventListener
	void onOrderReceived(OrderReceived order) {
		sender.execute(() -> notifyOrder(order));
	}

	@PreDestroy
	void stop() {
		sender.shutdownNow();
	}

	private void notifyRecipe(RecipePublished recipe) {
		deliver(jsonMapper.writeValueAsBytes(Map.of("notification", notification(recipe))), "new_recipes",
				"New recipe \"" + recipe.title() + "\"");
	}

	private void notifyOrder(OrderReceived order) {
		deliver(jsonMapper.writeValueAsBytes(Map.of("notification", notification(order))), "admin_orders",
				"Order " + order.number());
	}

	/** {@code audience}: the boolean column saying who receives it. */
	private void deliver(byte[] payload, String audience, String what) {
		List<Subscription> subscriptions = jdbc.sql("select id, endpoint, p256dh, auth, failures from push_subscription where " + audience)
			.query(Subscription.class)
			.list();
		int delivered = 0;
		int expired = 0;
		List<Subscription> refused = new ArrayList<>();
		for (Subscription subscription : subscriptions) {
			try {
				int status = send(subscription, payload);
				if (status / 100 == 2) {
					delivered++;
					if (subscription.failures() > 0) {
						jdbc.sql("update push_subscription set failures = 0 where id = :id").param("id", subscription.id()).update();
					}
				}
				else if (status == 404 || status == 410) {
					// Unsubscribed in the browser, or expired: never valid again
					delete(subscription);
					expired++;
				}
				else if (status / 100 == 4 && status != 429) {
					// Malformed, or signed for another key: a forged subscription is never accepted
					refused.add(subscription);
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
		// Nothing delivered at all: the fault is more likely the site's (keys, clock) than the subscriptions'
		int removed = 0;
		if (delivered > 0) {
			for (Subscription subscription : refused) {
				if (subscription.failures() + 1 >= MAX_FAILURES) {
					delete(subscription);
					removed++;
				}
				else {
					jdbc.sql("update push_subscription set failures = failures + 1 where id = :id")
						.param("id", subscription.id())
						.update();
				}
			}
		}
		log.info("{} notified: {} delivered, {} expired subscriptions removed, {} refused ({} removed), {} in all",
				what, delivered, expired, refused.size(), removed, subscriptions.size());
	}

	/** Only one per order, without the customer's name: it goes through the browsers' push services. */
	private static Map<String, Object> notification(OrderReceived order) {
		Map<String, Object> notification = new LinkedHashMap<>();
		notification.put("title", "Nouvelle commande n° " + order.number());
		notification.put("body", order.items() + (order.items() > 1 ? " articles · " : " article · ")
				+ order.amount().setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',') + " €");
		notification.put("icon", "/icons/icon-192.png");
		notification.put("lang", "fr");
		notification.put("data", Map.of("onActionClick", Map.of("default",
				Map.of("operation", "navigateLastFocusedOrOpen", "url", "/admin/boutique/commandes/" + order.number()))));
		return notification;
	}

	/** Same checks for a visitor's device and an admin's. */
	private static void checkSubscription(PushSubscriptionForm form) {
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
	}

	private void delete(Subscription subscription) {
		jdbc.sql("delete from push_subscription where id = :id").param("id", subscription.id()).update();
	}

	/**
	 * Why a new subscription from this sender is refused now, or null: {@link #PER_HOUR} an hour from
	 * an address, {@link #SITE_PER_HOUR} an hour for the whole site. An accepted one is counted.
	 */
	@Nullable ErrorCode refusal(String sender, Instant now) {
		Instant hourAgo = now.minus(Duration.ofHours(1));
		Deque<Instant> times = subscribedBy.computeIfAbsent(sender, key -> new ArrayDeque<>());
		synchronized (times) {
			dropBefore(times, hourAgo);
			if (times.size() >= PER_HOUR) {
				return ErrorCode.PUSH_TOO_MANY;
			}
			synchronized (subscribedBySite) {
				dropBefore(subscribedBySite, hourAgo);
				if (subscribedBySite.size() >= SITE_PER_HOUR) {
					return ErrorCode.PUSH_BUSY;
				}
				subscribedBySite.addLast(now);
			}
			times.addLast(now);
			return null;
		}
	}

	/** Every hour, the addresses not heard from for an hour. */
	@Scheduled(initialDelay = 3_600_000, fixedDelay = 3_600_000)
	void forgetSenders() {
		Instant hourAgo = Instant.now().minus(Duration.ofHours(1));
		subscribedBy.values().removeIf(times -> {
			synchronized (times) {
				return times.isEmpty() || times.peekLast().isBefore(hourAgo);
			}
		});
	}

	private static void dropBefore(Deque<Instant> times, Instant limit) {
		while (!times.isEmpty() && times.peekFirst().isBefore(limit)) {
			times.pollFirst();
		}
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
