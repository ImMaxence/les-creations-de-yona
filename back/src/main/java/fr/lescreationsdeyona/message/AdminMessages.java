package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.live.LiveChange;
import fr.lescreationsdeyona.live.LiveTopic;
import fr.lescreationsdeyona.message.MessageResponses.AdminMessage;
import fr.lescreationsdeyona.message.MessageResponses.GroupMember;
import fr.lescreationsdeyona.message.MessageResponses.MessagePage;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.monitoring.Unseen;
import fr.lescreationsdeyona.security.AdminProperties;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

/**
 * "Messages": what the admins write to each other, all of them in one group (every account allowed
 * into the back-office). Text, and mentions of the things of the site written in it. Kept 90 days, then
 * erased every night; saved with the rest of the site by the backups. Not in "Historique": it changes
 * nothing of the site. Each new message is told to the back-offices open (AdminLive).
 */
@Service
public class AdminMessages {

	static final Duration KEPT = Duration.ofDays(90);

	/** Characters of a message, its mentions written in: about 2,000 typed. */
	static final int MAX_BODY = 3000;

	static final int MAX_PAGE = 100;

	private static final Logger log = LoggerFactory.getLogger(AdminMessages.class);

	private final JdbcClient jdbc;

	private final AdminSeen adminSeen;

	private final AdminProperties admins;

	private final ApplicationEventPublisher events;

	AdminMessages(JdbcClient jdbc, AdminSeen adminSeen, AdminProperties admins, ApplicationEventPublisher events) {
		this.jdbc = jdbc;
		this.adminSeen = adminSeen;
		this.admins = admins;
		this.events = events;
	}

	/** The latest first; {@code before}: the id of the oldest one shown, for those written before it. */
	public MessagePage page(@Nullable Long before, int size) {
		int limit = Math.clamp(size, 1, MAX_PAGE);
		List<AdminMessage> found = jdbc.sql("""
				select * from admin_message where cast(:before as bigint) is null or id < :before
				order by id desc limit :limit""")
			.param("before", before)
			.param("limit", limit + 1)
			.query((row, index) -> new AdminMessage(row.getLong("id"), row.getString("author_email"), row.getString("author_name"),
					row.getString("author_picture"), row.getString("body"), row.getObject("sent_at", OffsetDateTime.class).toInstant()))
			.list();
		return new MessagePage(found.size() > limit ? found.subList(0, limit) : found, found.size() > limit);
	}

	/** Written by the admin signed in, with their name and photo as Google gives them. */
	public AdminMessage send(String text) {
		String body = clean(text);
		Author author = author();
		Instant now = Instant.now();
		long id = jdbc.sql("""
				insert into admin_message (author_email, author_name, author_picture, body, sent_at)
				values (:email, :name, :picture, :body, :at) returning id""")
			.param("email", author.email())
			.param("name", author.name())
			.param("picture", author.picture())
			.param("body", body)
			.param("at", utc(now))
			.query(Long.class)
			.single();
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES));
		return new AdminMessage(id, author.email(), author.name(), author.picture(), body, now);
	}

	/** Its own message only. */
	public void delete(long id) {
		String me = author().email();
		int deleted = jdbc.sql("delete from admin_message where id = :id and author_email = :me").param("id", id).param("me", me).update();
		if (deleted == 0) {
			boolean exists = jdbc.sql("select count(*) from admin_message where id = :id").param("id", id).query(Long.class).single() > 0;
			throw new ApiException(exists ? ErrorCode.ADMIN_MESSAGE_NOT_YOURS : ErrorCode.ADMIN_MESSAGE_NOT_FOUND);
		}
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES));
	}

	/** The badge of "Messages": those of the others since this admin last opened it. */
	public Unseen unseen() {
		Instant since = adminSeen.of(AdminSeen.Topic.MESSAGES)
			.map(AdminSeen.Mark::at)
			.orElseGet(() -> Instant.now().minus(Unseen.FIRST_TIME));
		long count = adminSeen.admin()
			.map(admin -> jdbc.sql("select count(*) from admin_message where sent_at > :since and lower(author_email) <> lower(:admin)")
				.param("since", utc(since))
				.param("admin", admin)
				.query(Long.class)
				.single())
			.orElse(0L);
		return new Unseen(count, since);
	}

	/** Every admin allowed into the back-office, named as in their last message. */
	public List<GroupMember> members() {
		Map<String, GroupMember> known = new HashMap<>();
		jdbc.sql("""
				select distinct on (lower(author_email)) lower(author_email) as email, author_name, author_picture
				from admin_message order by lower(author_email), id desc""")
			.query((row, index) -> new GroupMember(row.getString("email"), row.getString("author_name"), row.getString("author_picture")))
			.list()
			.forEach(member -> known.put(member.email(), member));
		return admins.emails()
			.stream()
			.sorted()
			.map(email -> known.getOrDefault(email, new GroupMember(email, null, null)))
			.toList();
	}

	/** Every night: older than 90 days. */
	@Scheduled(cron = "0 55 4 * * *", zone = "Europe/Paris")
	public void eraseExpired() {
		int erased = jdbc.sql("delete from admin_message where sent_at < :before").param("before", utc(Instant.now().minus(KEPT))).update();
		if (erased > 0) {
			log.info("{} message(s) between the admins erased after 90 days", erased);
		}
	}

	/** The text as sent, without the blank lines and spaces around it; refused empty. */
	static String clean(@Nullable String text) {
		String body = text == null ? "" : text.strip();
		if (body.isEmpty()) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_EMPTY);
		}
		return body;
	}

	private record Author(String email, @Nullable String name, @Nullable String picture) {
	}

	/** The admin signed in: their Google account, or only their email outside a Google login (tests). */
	private Author author() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.getPrincipal() instanceof OidcUser user && user.getEmail() != null) {
			return new Author(user.getEmail(), user.getFullName(), user.getPicture());
		}
		String email = adminSeen.admin().orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
		return new Author(email, null, null);
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

}
