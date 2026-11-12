package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.push.PushService;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * A message told on the devices of the other members (2.13), the installed app's notifications, as a chat
 * does: a few seconds after it is sent, only to the ones who have not read it by then (the conversation
 * open on their screen reads it at once), and once for a burst (the last message of the group only).
 * Each admin turns it on on their own devices (AdminMessageAlertController).
 */
@Component
class MessagePush {

	private static final Logger log = LoggerFactory.getLogger(MessagePush.class);

	/** Time for a member with the conversation open to read it: then not told. */
	static final Duration UNREAD_FOR = Duration.ofSeconds(10);

	private static final int EXCERPT = 140;

	private final JdbcClient jdbc;

	private final PushService push;

	private final ScheduledExecutorService later = Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().name("message-push").factory());

	MessagePush(JdbcClient jdbc, PushService push) {
		this.jdbc = jdbc;
		this.push = push;
	}

	/** Once the message is committed: a rolled back one tells nobody. */
	@TransactionalEventListener
	void onSent(MessageSent sent) {
		later.schedule(() -> check(sent), UNREAD_FOR.toMillis(), TimeUnit.MILLISECONDS);
	}

	void check(MessageSent sent) {
		try {
			// Deleted in the meantime, or another message after it (its own notification says it): nothing
			boolean last = jdbc.sql("""
					select exists (select 1 from admin_message where id = :id)
						and not exists (select 1 from admin_message where group_id = :group and id > :id and event is null)""")
				.param("id", sent.id())
				.param("group", sent.groupId())
				.query(Boolean.class)
				.single();
			if (!last) {
				return;
			}
			Set<String> read = new HashSet<>(jdbc.sql("select admin_email from admin_group_seen where group_id = :group and seen_at >= :sent")
				.param("group", sent.groupId())
				.param("sent", OffsetDateTime.ofInstant(sent.sentAt(), ZoneOffset.UTC))
				.query(String.class)
				.list());
			push.notifyAdmins(unread(sent.members(), sent.authorEmail(), read), notification(sent), "Message " + sent.id());
		}
		catch (RuntimeException ex) {
			log.warn("Notification of message {} failed", sent.id(), ex);
		}
	}

	/** The members told: not the author, nor the ones who read the group since the message. */
	static List<String> unread(Set<String> members, String author, Set<String> read) {
		Set<String> seen = new HashSet<>();
		read.forEach(email -> seen.add(email.toLowerCase(Locale.ROOT)));
		return members.stream()
			.map(email -> email.toLowerCase(Locale.ROOT))
			.filter(email -> !email.equals(author.toLowerCase(Locale.ROOT)) && !seen.contains(email))
			.sorted()
			.toList();
	}

	/**
	 * Shown by Angular's service worker: the group, then "Léa : the start of the message"; one per group
	 * on the device (the next one takes its place, ringing again); a tap opens the conversation.
	 */
	static Map<String, Object> notification(MessageSent sent) {
		String author = sent.authorName() == null || sent.authorName().isBlank() ? sent.authorEmail() : sent.authorName().strip().split("\\s+")[0];
		String text = MessageTexts.excerpt(sent.body(), EXCERPT);
		if (text.isEmpty()) {
			text = sent.photos() > 1 ? sent.photos() + " photos" : "Une photo";
		}
		Map<String, Object> notification = new LinkedHashMap<>();
		notification.put("title", sent.groupName());
		notification.put("body", author + " : " + text);
		notification.put("icon", "/icons/icon-192.png");
		notification.put("tag", "messages-" + sent.groupId());
		notification.put("renotify", true);
		notification.put("lang", "fr");
		notification.put("data", Map.of("onActionClick",
				Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", "/admin/messages?groupe=" + sent.groupId()))));
		return notification;
	}

	@PreDestroy
	void stop() {
		later.shutdownNow();
	}

}
