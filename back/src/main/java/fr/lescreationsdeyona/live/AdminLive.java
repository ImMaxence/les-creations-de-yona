package fr.lescreationsdeyona.live;

import fr.lescreationsdeyona.shop.OrderReceived;
import java.io.IOException;
import java.security.Principal;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * The back-office in real time: each page of the back-office open keeps a WebSocket here
 * ({@code /api/admin/live}, admins only, like the rest of {@code /api/admin}), and is told what
 * changed: {@code {"topic":"HISTORY"}}. It then asks its own counts again, which differ by admin
 * (the changes of the others). Nothing else goes through it but the name of a badge, and "est en
 * train d'écrire…": a page sends {@code {"typing":12}} while its admin writes in group 12, and the
 * other members of the group are told {@code {"topic":"TYPING","group":12,"email":…,"name":…}}.
 */
@Component
public class AdminLive extends TextWebSocketHandler {

	static final String PATH = "/api/admin/live";

	/** Proxies close a connection silent for 100 seconds (Cloudflare): a word every 25 seconds keeps it. */
	static final String HEARTBEAT = "{\"topic\":\"PING\"}";

	/** A page says so every few seconds while its admin writes; more often is ignored. */
	static final long TYPING_EVERY_MS = 1_500;

	private static final Pattern TYPING = Pattern.compile("\\{\\s*\"typing\"\\s*:\\s*(\\d{1,18})\\s*}");

	private static final int SEND_TIME_LIMIT_MS = 5_000;

	private static final int BUFFER_SIZE_LIMIT = 64 * 1024;

	private static final Logger log = LoggerFactory.getLogger(AdminLive.class);

	/** An open page, and the admin it is open for (none outside a Google login: tests). */
	private record Open(WebSocketSession session, @Nullable String email, @Nullable String name, long[] lastTyping) {
	}

	private final Map<String, Open> open = new ConcurrentHashMap<>();

	private final ObjectProvider<TypingRelay> typingRelay;

	public AdminLive(ObjectProvider<TypingRelay> typingRelay) {
		this.typingRelay = typingRelay;
	}

	@Override
	public void afterConnectionEstablished(WebSocketSession session) {
		@Nullable OidcUser user = userOf(session.getPrincipal());
		if (user == null || user.getEmail() == null) {
			// Told nothing of the groups, nor who writes: seen in "Journaux" if it ever happens
			log.warn("Live connection {} opened without a Google account: no group news nor typing for it", session.getId());
		}
		// In the logs of the server: opened here while the browser says it never connects, a proxy breaks it on the way
		log.info("Live connection opened ({} open)", open.size() + 1);
		// Several threads may send at once: one at a time per connection, a stuck one dropped
		open.put(session.getId(), new Open(new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT),
				user == null || user.getEmail() == null ? null : user.getEmail().toLowerCase(Locale.ROOT),
				user == null ? null : user.getFullName(), new long[1]));
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		open.remove(session.getId());
	}

	@Override
	public void handleTransportError(WebSocketSession session, Throwable exception) {
		open.remove(session.getId());
	}

	/** "est en train d'écrire…" from a page: told to the other members of the group, at most every 1.5 s. */
	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) {
		Open page = open.get(session.getId());
		Matcher typing = TYPING.matcher(message.getPayload());
		if (page == null || page.email() == null || !typing.matches()) {
			return;
		}
		long now = System.currentTimeMillis();
		synchronized (page.lastTyping()) {
			if (now - page.lastTyping()[0] < TYPING_EVERY_MS) {
				return;
			}
			page.lastTyping()[0] = now;
		}
		long group = Long.parseLong(typing.group(1));
		TypingRelay relay = typingRelay.getIfAvailable();
		tellTyping(group, page.email(), page.name(), relay == null ? Set.of() : relay.writing(group, page.email(), page.name()));
	}

	/** "est en train d'écrire…" told to the members of the group but the writer; also when a page says it over HTTP (its WebSocket cut). */
	public void tellTyping(long group, String email, @Nullable String name, Set<String> members) {
		if (members.isEmpty()) {
			return;
		}
		String writer = email.toLowerCase(Locale.ROOT);
		String told = "{\"topic\":\"TYPING\",\"group\":" + group + ",\"email\":" + json(writer) + ",\"name\":"
				+ (name == null ? "null" : json(name)) + "}";
		send(told, members, writer);
	}

	/** The pages of the back-office open now. */
	int connections() {
		return open.size();
	}

	/** After the commit of the change, or at once outside a transaction. */
	@TransactionalEventListener(fallbackExecution = true)
	void onChange(LiveChange change) {
		send("{\"topic\":\"" + change.topic().name() + "\"}", change.audience(), null);
	}

	@TransactionalEventListener(fallbackExecution = true)
	void onOrderReceived(OrderReceived order) {
		onChange(new LiveChange(LiveTopic.ORDERS));
	}

	@Scheduled(initialDelay = 25_000, fixedDelay = 25_000)
	void heartbeat() {
		if (!open.isEmpty()) {
			send(HEARTBEAT, null, null);
		}
	}

	/** {@code audience}: those told, null for all; {@code except}: an admin left out (the one writing). */
	private void send(String text, @Nullable Set<String> audience, @Nullable String except) {
		TextMessage message = new TextMessage(text);
		for (Open page : open.values()) {
			boolean outside = audience != null && (page.email() == null || !audience.contains(page.email()));
			if (outside || (except != null && except.equals(page.email()))) {
				continue;
			}
			WebSocketSession session = page.session();
			if (!session.isOpen()) {
				open.remove(session.getId());
				continue;
			}
			try {
				session.sendMessage(message);
			}
			catch (IOException | RuntimeException ex) {
				// Gone without saying so (a phone asleep): it connects again on its own
				open.remove(session.getId());
				log.debug("Live connection {} dropped: {}", session.getId(), ex.toString());
			}
		}
	}

	private static @Nullable OidcUser userOf(@Nullable Principal principal) {
		return principal instanceof Authentication authentication && authentication.getPrincipal() instanceof OidcUser user ? user : null;
	}

	/** A JSON string: quotes, backslashes and control characters escaped. */
	static String json(String text) {
		StringBuilder written = new StringBuilder("\"");
		for (char c : text.toCharArray()) {
			switch (c) {
				case '"' -> written.append("\\\"");
				case '\\' -> written.append("\\\\");
				default -> {
					if (c < 0x20 || c == ' ' || c == ' ') {
						written.append(String.format("\\u%04x", (int) c));
					}
					else {
						written.append(c);
					}
				}
			}
		}
		return written.append('"').toString();
	}

}
