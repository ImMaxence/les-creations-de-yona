package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.push.PushService;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * A message told on the devices of the other members (2.13), the installed app's notifications, as a chat
 * does: a few seconds after it is sent, only to the ones who have not read it by then (the conversation
 * open on their screen reads it at once), and once for a burst (the last message of the group only).
 * Each admin turns it on on their own devices (AdminMessageAlertController). The lines of the groups too (2.18),
 * written by a member ("Léa a ajouté Sam") or by the site (a new version), the same way.
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

	/** Once the line is committed, as a message. */
	@TransactionalEventListener
	void onLine(LineWritten line) {
		later.schedule(() -> check(line), UNREAD_FOR.toMillis(), TimeUnit.MILLISECONDS);
	}

	/**
	 * Told to the members who have not read the group since, but its author. The member a line adds or removes is told
	 * in their own words ("Léa vous a ajouté au groupe"), always; the others only when it is the last of the group (a
	 * message or a line after it says it in its place).
	 */
	void check(LineWritten line) {
		try {
			Boolean exists = jdbc.sql("select exists (select 1 from admin_message where id = :id)")
				.param("id", line.id())
				.query(Boolean.class)
				.single();
			if (!Boolean.TRUE.equals(exists)) {
				return;
			}
			boolean last = !jdbc.sql("select exists (select 1 from admin_message where group_id = :group and id > :id)")
				.param("group", line.groupId())
				.param("id", line.id())
				.query(Boolean.class)
				.single();
			Set<String> read = new HashSet<>(jdbc.sql("select admin_email from admin_group_seen where group_id = :group and seen_at >= :sent")
				.param("group", line.groupId())
				.param("sent", OffsetDateTime.ofInstant(line.sentAt(), ZoneOffset.UTC))
				.query(String.class)
				.list());
			String concerned = concerned(line);
			Audiences told = audiences(unread(line.members(), line.actorEmail(), read), concerned, last);
			String actor = firstName(line.actorName(), line.actorEmail());
			String concernedName = concerned == null ? null : firstName(knownName(concerned), concerned);
			push.notifyAdmins(told.concerned(), notification(line, actor, concernedName, true), "Ligne " + line.id());
			push.notifyAdmins(told.others(), notification(line, actor, concernedName, false), "Ligne " + line.id());
		}
		catch (RuntimeException ex) {
			log.warn("Notification of line {} failed", line.id(), ex);
		}
	}

	/** The member a line adds or removes; null for the other lines. */
	static @Nullable String concerned(LineWritten line) {
		return (line.event() == GroupEvent.ADDED || line.event() == GroupEvent.REMOVED) && line.value() != null
				? line.value().toLowerCase(Locale.ROOT) : null;
	}

	/** Who is told a line in their own words, who in the words of all. */
	record Audiences(List<String> concerned, List<String> others) {
	}

	/** {@code unread}: the members told, by {@link #unread}. */
	static Audiences audiences(List<String> unread, @Nullable String concerned, boolean last) {
		List<String> others = new ArrayList<>(unread);
		boolean toConcerned = concerned != null && others.remove(concerned);
		return new Audiences(toConcerned ? List.of(concerned) : List.of(), last ? List.copyOf(others) : List.of());
	}

	/** The name of an admin as their last message says it; null without any. */
	private @Nullable String knownName(String email) {
		return jdbc.sql("""
				select author_name from admin_message where lower(author_email) = :email and author_name is not null
				order by sent_at desc limit 1""")
			.param("email", email)
			.query(String.class)
			.optional()
			.orElse(null);
	}

	/** "Léa" for "Léa Martin", the email for an admin without a name. */
	static String firstName(@Nullable String name, String email) {
		return name == null || name.isBlank() ? email : name.strip().split("\\s+")[0];
	}

	/**
	 * The group, then the line as the reader would read it in the conversation: "Léa vous a ajouté au groupe" for the
	 * member added, "Léa a ajouté Sam" for the others, "Nouvelle version de l'application disponible : version 2.18.0".
	 */
	static Map<String, Object> notification(LineWritten line, String actor, @Nullable String concerned, boolean toConcerned) {
		String body = switch (line.event()) {
			case CREATED -> actor + " a créé le groupe « " + line.groupName() + " »";
			case RENAMED -> actor + " a renommé le groupe « " + line.value() + " »";
			case PHOTO_CHANGED -> actor + " a changé la photo du groupe";
			case PHOTO_REMOVED -> actor + " a retiré la photo du groupe";
			case ADDED -> toConcerned ? actor + " vous a ajouté au groupe" : actor + " a ajouté " + concerned;
			case REMOVED -> toConcerned ? actor + " vous a retiré du groupe" : actor + " a retiré " + concerned;
			case LEFT -> actor + " a quitté le groupe";
			case VERSION -> "Nouvelle version de l'application disponible : version " + line.value();
		};
		// Out of the group, its conversation is no longer theirs: the messages page
		String url = toConcerned && line.event() == GroupEvent.REMOVED ? "/admin/messages" : "/admin/messages?groupe=" + line.groupId();
		return payload(line.groupName(), body, line.groupId(), url);
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
		String author = firstName(sent.authorName(), sent.authorEmail());
		String text = MessageTexts.excerpt(sent.body(), EXCERPT);
		if (text.isEmpty()) {
			text = sent.photos() > 1 ? sent.photos() + " photos" : "Une photo";
		}
		return payload(sent.groupName(), author + " : " + text, sent.groupId(), "/admin/messages?groupe=" + sent.groupId());
	}

	/** One per group on the device (the next one takes its place, ringing again); a tap opens {@code url}. */
	private static Map<String, Object> payload(String title, String body, long groupId, String url) {
		Map<String, Object> notification = new LinkedHashMap<>();
		notification.put("title", title);
		notification.put("body", body);
		notification.put("icon", "/icons/icon-192.png");
		notification.put("tag", "messages-" + groupId);
		notification.put("renotify", true);
		notification.put("lang", "fr");
		notification.put("data", Map.of("onActionClick", Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", url))));
		return notification;
	}

	@PreDestroy
	void stop() {
		later.shutdownNow();
	}

}
