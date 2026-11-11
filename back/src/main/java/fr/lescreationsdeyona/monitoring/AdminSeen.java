package fr.lescreationsdeyona.monitoring;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.AuditorAware;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * What the admin logged in has already looked at, page by page: the badges of the back-office menu
 * count what came after. Kept by admin (Yona and Maxence each have theirs), on every device.
 */
@Service
public class AdminSeen {

	/** The pages followed. */
	public enum Topic {
		HISTORY, CHANGELOG, LOGS, TRASH, MESSAGES
	}

	/** When, and for the changelog which version. */
	public record Mark(Instant at, @Nullable String version) {
	}

	private final JdbcClient jdbc;

	private final AuditorAware<String> auditor;

	AdminSeen(JdbcClient jdbc, AuditorAware<String> auditor) {
		this.jdbc = jdbc;
		this.auditor = auditor;
	}

	/** The email of the admin asking; empty outside a request of the back-office. */
	public Optional<String> admin() {
		return auditor.getCurrentAuditor();
	}

	/** Empty the first time. */
	public Optional<Mark> of(Topic topic) {
		return admin().flatMap(email -> jdbc.sql("select seen_at, seen_version from admin_seen where admin_email = :email and topic = :topic")
			.param("email", email)
			.param("topic", topic.name())
			.query((row, index) -> new Mark(row.getObject("seen_at", OffsetDateTime.class).toInstant(), row.getString("seen_version")))
			.optional());
	}

	/** Seen now; {@code version}: the version of the changelog read, null for the other pages. */
	public void mark(Topic topic, @Nullable String version) {
		admin().ifPresent(email -> jdbc.sql("""
				insert into admin_seen (admin_email, topic, seen_at, seen_version) values (:email, :topic, :at, :version)
				on conflict (admin_email, topic) do update set seen_at = excluded.seen_at, seen_version = excluded.seen_version""")
			.param("email", email)
			.param("topic", topic.name())
			.param("at", OffsetDateTime.now(ZoneOffset.UTC))
			.param("version", version)
			.update());
	}

}
