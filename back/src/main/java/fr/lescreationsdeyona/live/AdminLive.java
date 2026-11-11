package fr.lescreationsdeyona.live;

import fr.lescreationsdeyona.shop.OrderReceived;
import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
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
 * (the changes of the others). Nothing else goes through it: no content, only the name of a badge.
 */
@Component
public class AdminLive extends TextWebSocketHandler {

	static final String PATH = "/api/admin/live";

	/** Proxies close a connection silent for 100 seconds (Cloudflare): a word every 25 seconds keeps it. */
	static final String HEARTBEAT = "{\"topic\":\"PING\"}";

	private static final int SEND_TIME_LIMIT_MS = 5_000;

	private static final int BUFFER_SIZE_LIMIT = 64 * 1024;

	private static final Logger log = LoggerFactory.getLogger(AdminLive.class);

	private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) {
		// Several threads may send at once: one at a time per connection, a stuck one dropped
		sessions.add(new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT));
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		sessions.removeIf(open -> open.getId().equals(session.getId()));
	}

	@Override
	public void handleTransportError(WebSocketSession session, Throwable exception) {
		sessions.removeIf(open -> open.getId().equals(session.getId()));
	}

	/** The pages of the back-office open now. */
	int connections() {
		return sessions.size();
	}

	/** After the commit of the change, or at once outside a transaction. */
	@TransactionalEventListener(fallbackExecution = true)
	void onChange(LiveChange change) {
		send("{\"topic\":\"" + change.topic().name() + "\"}");
	}

	@TransactionalEventListener(fallbackExecution = true)
	void onOrderReceived(OrderReceived order) {
		onChange(new LiveChange(LiveTopic.ORDERS));
	}

	@Scheduled(initialDelay = 25_000, fixedDelay = 25_000)
	void heartbeat() {
		if (!sessions.isEmpty()) {
			send(HEARTBEAT);
		}
	}

	private void send(String text) {
		TextMessage message = new TextMessage(text);
		for (WebSocketSession session : sessions) {
			if (!session.isOpen()) {
				sessions.remove(session);
				continue;
			}
			try {
				session.sendMessage(message);
			}
			catch (IOException | RuntimeException ex) {
				// Gone without saying so (a phone asleep): it connects again on its own
				sessions.remove(session);
				log.debug("Live connection {} dropped: {}", session.getId(), ex.toString());
			}
		}
	}

}
