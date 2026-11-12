package fr.lescreationsdeyona.monitoring;

import ch.qos.logback.classic.LoggerContext;
import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.live.LiveChange;
import fr.lescreationsdeyona.live.LiveTopic;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.jspecify.annotations.Nullable;
import org.slf4j.ILoggerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * "Journaux": the errors and warnings of the site, the backend's own and those of the visitors'
 * browsers. Caught in memory as they happen, then written every 20 seconds (and before each reading),
 * the same problem again adding to its count. Kept 30 days, 2,000 lines at most.
 */
@Service
public class ErrorLog {

	private static final Logger log = LoggerFactory.getLogger(ErrorLog.class);

	/** Waiting to be written: beyond, a storm of errors is cut (the first ones say enough). */
	static final int MAX_WAITING = 500;

	static final Duration KEPT = Duration.ofDays(30);

	static final int MAX_LINES = 2000;

	/** Errors sent by browsers, for the whole site: a broken page in many browsers stays readable. */
	static final int BROWSER_ERRORS_PER_MINUTE = 30;

	/** A line of the log. */
	public record ErrorLogLine(long id, LoggedProblem.Level level, LoggedProblem.Source source, @Nullable String logger, String message,
			@Schema(description = "Stack trace of the backend, or of the browser") @Nullable String detail,
			@Schema(description = "The page of the site it happened on, for a browser") @Nullable String page,
			@Schema(description = "How many times, since the first") int occurrences, Instant firstSeenAt, Instant lastSeenAt,
			@Schema(description = "Archived (the problem handled): out of the list, kept 30 days like the others") @Nullable Instant archivedAt,
			@Schema(description = "Archived once, then happened again") boolean cameBack) {
	}

	/** The counters at the top of "Journaux", and the badge of the menu. */
	public record ErrorLogSummary(long errorsLast24Hours, long warningsLast24Hours,
			@Schema(description = "Lines of the log to handle (not archived), 30 days at most") long lines,
			@Schema(description = "Lines archived") long archived,
			@Schema(description = "The last time an error happened") @Nullable Instant lastErrorAt,
			@Schema(description = "Errors (not warnings) seen again or new since this admin last opened the log") long unseenErrors,
			Instant since) {
	}

	private final JdbcClient jdbc;

	private final AdminSeen adminSeen;

	private final ApplicationEventPublisher events;

	private final Queue<LoggedProblem> waiting = new ConcurrentLinkedQueue<>();

	private final AtomicInteger waitingCount = new AtomicInteger();

	private final AtomicLong browserMinute = new AtomicLong();

	private final AtomicInteger browserErrorsThisMinute = new AtomicInteger();

	private final @Nullable ProblemAppender appender;

	ErrorLog(JdbcClient jdbc, AdminSeen adminSeen, ApplicationEventPublisher events) {
		this.jdbc = jdbc;
		this.adminSeen = adminSeen;
		this.events = events;
		this.appender = attach();
	}

	/** On the root logger, next to the console: every warning of the backend comes through it. */
	private @Nullable ProblemAppender attach() {
		ILoggerFactory factory = LoggerFactory.getILoggerFactory();
		if (!(factory instanceof LoggerContext context)) {
			return null;
		}
		ProblemAppender problems = new ProblemAppender(this::add);
		problems.setContext(context);
		problems.start();
		context.getLogger(Logger.ROOT_LOGGER_NAME).addAppender(problems);
		return problems;
	}

	@PreDestroy
	void detach() {
		if (appender != null && LoggerFactory.getILoggerFactory() instanceof LoggerContext context) {
			context.getLogger(Logger.ROOT_LOGGER_NAME).detachAppender(appender);
			appender.stop();
		}
		flush();
	}

	void add(LoggedProblem problem) {
		if (waitingCount.incrementAndGet() > MAX_WAITING) {
			waitingCount.decrementAndGet();
			return;
		}
		waiting.add(problem);
	}

	/** An error of a visitor's browser; false when too many came this minute (it is left out). */
	public boolean addFromBrowser(String message, @Nullable String detail, @Nullable String page) {
		long minute = System.currentTimeMillis() / 60_000;
		if (browserMinute.getAndSet(minute) != minute) {
			browserErrorsThisMinute.set(0);
		}
		if (browserErrorsThisMinute.incrementAndGet() > BROWSER_ERRORS_PER_MINUTE) {
			return false;
		}
		// The same message from the same place: the first line of the stack says where
		String firstFrame = detail == null ? "" : detail.strip().lines().skip(1).findFirst().orElse("").strip();
		add(LoggedProblem.of(LoggedProblem.Level.ERROR, LoggedProblem.Source.BROWSER, null, message, detail, pathOf(page),
				message.strip() + "|" + firstFrame, Instant.now()));
		return true;
	}

	/** The page without its query (a search, a token of an order): only where it happened. */
	static @Nullable String pathOf(@Nullable String page) {
		if (page == null) {
			return null;
		}
		int end = page.indexOf('?');
		int anchor = page.indexOf('#');
		int cut = end < 0 ? anchor : anchor < 0 ? end : Math.min(end, anchor);
		return cut < 0 ? page : page.substring(0, cut);
	}

	/** What waits, written: each problem once, with how many times it came. */
	@Scheduled(fixedDelay = 20_000, initialDelay = 20_000)
	public synchronized void flush() {
		Map<String, Group> groups = new LinkedHashMap<>();
		LoggedProblem problem;
		while ((problem = waiting.poll()) != null) {
			waitingCount.decrementAndGet();
			groups.computeIfAbsent(problem.fingerprint(), fingerprint -> new Group()).add(problem);
		}
		if (!groups.isEmpty()) {
			write(groups.values());
			// The badge counts errors only: a warning is news for nobody
			if (groups.values().stream().anyMatch(group -> group.last != null && group.last.level() == LoggedProblem.Level.ERROR)) {
				events.publishEvent(new LiveChange(LiveTopic.LOGS));
			}
		}
	}

	private void write(Collection<Group> groups) {
		try {
			for (Group group : groups) {
				LoggedProblem last = group.last;
				if (last == null) {
					continue;
				}
				jdbc.sql("""
						insert into app_log (fingerprint, level, source, logger, message, detail, page, occurrences, first_seen_at, last_seen_at)
						values (:fingerprint, :level, :source, :logger, :message, :detail, :page, :count, :first, :last)
						on conflict (fingerprint) do update set occurrences = app_log.occurrences + excluded.occurrences,
							last_seen_at = greatest(app_log.last_seen_at, excluded.last_seen_at), message = excluded.message,
							detail = coalesce(excluded.detail, app_log.detail), page = coalesce(excluded.page, app_log.page),
							came_back = app_log.came_back or app_log.archived_at is not null, archived_at = null""")
					.param("fingerprint", last.fingerprint())
					.param("level", last.level().name())
					.param("source", last.source().name())
					.param("logger", last.logger())
					.param("message", last.message())
					.param("detail", last.detail())
					.param("page", last.page())
					.param("count", group.count)
					.param("first", utc(group.first))
					.param("last", utc(last.at()))
					.update();
			}
		} catch (RuntimeException e) {
			// The database out of reach: those are lost, the console still has them. Not caught again (own logger).
			log.warn("Error log not written: {}", e.toString());
		}
	}

	/** The latest first; {@code level} and {@code source} null for all; those to handle, or those archived (the latest archived first). */
	public PageResponse<ErrorLogLine> lines(LoggedProblem.@Nullable Level level, LoggedProblem.@Nullable Source source, boolean archived,
			int page, int size) {
		flush();
		String where = "where (cast(:level as text) is null or level = :level) and (cast(:source as text) is null or source = :source)"
				+ (archived ? " and archived_at is not null" : " and archived_at is null");
		long total = jdbc.sql("select count(*) from app_log " + where)
			.param("level", level == null ? null : level.name())
			.param("source", source == null ? null : source.name())
			.query(Long.class)
			.single();
		String order = archived ? " order by archived_at desc, id desc" : " order by last_seen_at desc, id desc";
		List<ErrorLogLine> lines = jdbc.sql("select * from app_log " + where + order + " limit :size offset :offset")
			.param("level", level == null ? null : level.name())
			.param("source", source == null ? null : source.name())
			.param("size", size)
			.param("offset", (long) page * size)
			.query((row, index) -> new ErrorLogLine(row.getLong("id"), LoggedProblem.Level.valueOf(row.getString("level")),
					LoggedProblem.Source.valueOf(row.getString("source")), row.getString("logger"), row.getString("message"),
					row.getString("detail"), row.getString("page"), row.getInt("occurrences"),
					row.getObject("first_seen_at", OffsetDateTime.class).toInstant(),
					row.getObject("last_seen_at", OffsetDateTime.class).toInstant(), instant(row.getObject("archived_at", OffsetDateTime.class)),
					row.getBoolean("came_back")))
			.list();
		return new PageResponse<>(lines, page, size, total, (int) Math.ceil((double) total / size));
	}

	public ErrorLogSummary summary() {
		flush();
		Instant since = adminSeen.of(AdminSeen.Topic.LOGS).map(AdminSeen.Mark::at).orElseGet(() -> Instant.now().minus(Unseen.FIRST_TIME));
		return jdbc.sql("""
				select count(*) filter (where level = 'ERROR' and last_seen_at > now() - interval '24 hours' and archived_at is null) as errors,
					count(*) filter (where level = 'WARN' and last_seen_at > now() - interval '24 hours' and archived_at is null) as warnings,
					count(*) filter (where archived_at is null) as lines,
					count(*) filter (where archived_at is not null) as archived,
					max(last_seen_at) filter (where level = 'ERROR' and archived_at is null) as last_error,
					count(*) filter (where level = 'ERROR' and last_seen_at > :since and archived_at is null) as unseen
				from app_log""")
			.param("since", utc(since))
			.query((row, index) -> {
				OffsetDateTime lastError = row.getObject("last_error", OffsetDateTime.class);
				return new ErrorLogSummary(row.getLong("errors"), row.getLong("warnings"), row.getLong("lines"), row.getLong("archived"),
						lastError == null ? null : lastError.toInstant(), row.getLong("unseen"), since);
			})
			.single();
	}

	/**
	 * Archived (the problem handled: out of the list, not erased), or back in the list; {@code ids} null for
	 * all those of the other list. The mark "come back" goes either way.
	 */
	public void archive(@Nullable List<Long> ids, boolean archived) {
		flush();
		if (ids != null && ids.isEmpty()) {
			return;
		}
		String which = (archived ? "archived_at is null" : "archived_at is not null") + (ids == null ? "" : " and id in (:ids)");
		JdbcClient.StatementSpec update = jdbc.sql("update app_log set archived_at = :at, came_back = false where " + which)
			.param("at", archived ? utc(Instant.now()) : null);
		if (ids != null) {
			update = update.param("ids", ids);
		}
		update.update();
		events.publishEvent(new LiveChange(LiveTopic.LOGS));
	}

	/** Some lines, or all ({@code ids} null): the problem solved, or seen enough. */
	public void erase(@Nullable List<Long> ids) {
		flush();
		if (ids == null) {
			jdbc.sql("delete from app_log").update();
		} else if (!ids.isEmpty()) {
			jdbc.sql("delete from app_log where id in (:ids)").param("ids", ids).update();
		}
		events.publishEvent(new LiveChange(LiveTopic.LOGS));
	}

	/** Every night: older than 30 days, and beyond 2,000 lines the oldest. */
	@Scheduled(cron = "0 50 4 * * *", zone = "Europe/Paris")
	public void eraseExpired() {
		jdbc.sql("delete from app_log where last_seen_at < :before").param("before", utc(Instant.now().minus(KEPT))).update();
		jdbc.sql("delete from app_log where id not in (select id from app_log order by last_seen_at desc limit :max)")
			.param("max", MAX_LINES)
			.update();
	}

	private static @Nullable Instant instant(@Nullable OffsetDateTime at) {
		return at == null ? null : at.toInstant();
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

	/** The same problem, several times in 20 seconds. */
	private static final class Group {

		private int count;

		private Instant first = Instant.MAX;

		private @Nullable LoggedProblem last;

		void add(LoggedProblem problem) {
			count++;
			if (problem.at().isBefore(first)) {
				first = problem.at();
			}
			if (last == null || !problem.at().isBefore(last.at())) {
				last = problem;
			}
		}

	}

	/** For the tests: what waits to be written. */
	List<LoggedProblem> waiting() {
		return new ArrayList<>(waiting);
	}

}
