package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.live.LiveChange;
import fr.lescreationsdeyona.live.LiveTopic;
import fr.lescreationsdeyona.security.AdminProperties;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A new version of the application, told by the site itself in the group of all the admins once the
 * backend has started: "Nouvelle version de l'application disponible : version 2.14.0". A line of the
 * group like the others ({@link GroupEvent#VERSION}): no badge, no sound ("Nouveautés" has its own badge), but
 * a notification on the devices of the admins who turned them on (2.18), as a message. Not told again when the
 * same version starts again (a restart, a second server during a deployment), nor when an older one comes back
 * (a rollback); never for a backend run without its version (from an IDE). The versions told are this server's
 * ({@code announced_version}), not the backups'.
 */
@Service
class VersionAnnouncement {

	/** The author of the lines written by the site itself: no admin (no "@", never one of their emails). */
	static final String SITE = "site";

	private static final Pattern RELEASE = Pattern.compile("\\d{1,9}\\.\\d{1,9}\\.\\d{1,9}");

	private static final Logger log = LoggerFactory.getLogger(VersionAnnouncement.class);

	private final JdbcClient jdbc;

	private final ObjectProvider<BuildProperties> buildProperties;

	private final TransactionTemplate transactions;

	private final ApplicationEventPublisher events;

	private final AdminProperties admins;

	VersionAnnouncement(JdbcClient jdbc, ObjectProvider<BuildProperties> buildProperties, TransactionTemplate transactions,
			ApplicationEventPublisher events, AdminProperties admins) {
		this.jdbc = jdbc;
		this.buildProperties = buildProperties;
		this.transactions = transactions;
		this.events = events;
		this.admins = admins;
	}

	@EventListener(ApplicationReadyEvent.class)
	void onStarted() {
		BuildProperties build = buildProperties.getIfAvailable();
		if (build == null || build.getVersion() == null) {
			return;
		}
		String version = build.getVersion();
		try {
			if (Boolean.TRUE.equals(transactions.execute(status -> announce(version)))) {
				log.info("Version {} told to the admins in their group", version);
			}
		}
		catch (RuntimeException ex) {
			// Never keeps the site from starting
			log.warn("Version {} could not be told to the admins", version, ex);
		}
	}

	/** Told now in the group of all the admins, if newer than every version told before; false otherwise. */
	boolean announce(String version) {
		if (!isRelease(version) || !isNewest(version, jdbc.sql("select version from announced_version").query(String.class).list())) {
			return false;
		}
		Long everyone = jdbc.sql("select id from admin_group where everyone").query(Long.class).optional().orElse(null);
		if (everyone == null) {
			return false;
		}
		// Two servers starting together (a deployment): only the first to write it tells it
		Instant now = Instant.now();
		if (jdbc.sql("insert into announced_version (version, announced_at) values (:version, :at) on conflict do nothing")
			.param("version", version)
			.param("at", now.atOffset(ZoneOffset.UTC))
			.update() == 0) {
			return false;
		}
		long id = jdbc.sql("""
				insert into admin_message (group_id, author_email, body, sent_at, event, event_value)
				values (:group, :site, :body, :at, :event, :version) returning id""")
			.param("group", everyone)
			.param("site", SITE)
			.param("body", AdminGroups.sentence(SITE, GroupEvent.VERSION, version))
			.param("at", now.atOffset(ZoneOffset.UTC))
			.param("event", GroupEvent.VERSION.name())
			.param("version", version)
			.query(Long.class)
			.single();
		String groupName = jdbc.sql("select name from admin_group where id = :id").param("id", everyone).query(String.class).single();
		// Every admin is in the group of all of them; each told on their devices too (2.18)
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES));
		events.publishEvent(new LineWritten(id, everyone, groupName, GroupEvent.VERSION, version, SITE, null, now, admins.emails()));
		return true;
	}

	/** A version of the pom as released, "2.14.0": not "dev" nor a snapshot. */
	static boolean isRelease(String version) {
		return RELEASE.matcher(version).matches();
	}

	/** Newer than every version told before, number by number: 2.10.0 comes after 2.9.3. */
	static boolean isNewest(String version, Collection<String> told) {
		return told.stream().filter(VersionAnnouncement::isRelease).allMatch(before -> Arrays.compare(numbers(version), numbers(before)) > 0);
	}

	private static int[] numbers(String version) {
		return Arrays.stream(version.split("\\.")).mapToInt(Integer::parseInt).toArray();
	}

}
