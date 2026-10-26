package fr.lescreationsdeyona.search;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Searches of the public site that found no recipe: ideas of recipes to write. Only the text typed
 * is kept (lower-cased) with a count and dates, nothing about who searched: no IP address, no
 * cookie. Bounded, so that a flood of searches cannot fill the database.
 */
@Service
@RequiredArgsConstructor
public class SearchMissService {

	/** Distinct texts kept at most: past it, only the texts already noted are counted. */
	private static final int MAX_TERMS = 500;

	private static final int MAX_LENGTH = 100;

	/**
	 * The same text again within this delay counts once: a page rendered by the server is fetched
	 * again by the browser for offline reading, and a visitor may reload.
	 */
	private static final Duration REPEAT_WINDOW = Duration.ofMinutes(1);

	private static final Pattern SPACES = Pattern.compile("\\s+");

	/** Past this many texts noted within the window (a flood of searches), the memory starts over. */
	private static final int MAX_REMEMBERED = 5_000;

	private final JdbcClient jdbc;

	private final Map<String, Instant> recentlyNoted = new ConcurrentHashMap<>();

	public record SearchMiss(String term, long count, Instant lastSearchedAt) {
	}

	@Transactional
	public void record(String text) {
		String term = normalize(text);
		Instant now = Instant.now();
		if (term.isEmpty() || isRepeat(term, now)) {
			return;
		}
		jdbc.sql("delete from search_miss where last_searched_at < now() - interval '12 months'").update();
		jdbc.sql("""
				insert into search_miss (term, count, first_searched_at, last_searched_at)
				select :term, 1, now(), now()
				where (select count(*) from search_miss) < :maxTerms
					or exists (select 1 from search_miss where term = :term)
				on conflict (term) do update
					set count = search_miss.count + 1, last_searched_at = excluded.last_searched_at""")
			.param("term", term)
			.param("maxTerms", MAX_TERMS)
			.update();
	}

	/** The most searched first. */
	@Transactional(readOnly = true)
	public List<SearchMiss> top(int limit) {
		return jdbc.sql("""
				select term, count, last_searched_at from search_miss
				order by count desc, last_searched_at desc limit :limit""")
			.param("limit", limit)
			.query((row, index) -> new SearchMiss(row.getString("term"), row.getLong("count"),
					row.getObject("last_searched_at", OffsetDateTime.class).toInstant()))
			.list();
	}

	/** One text, or all of them when {@code term} is null. */
	@Transactional
	public void delete(@Nullable String term) {
		if (term == null) {
			jdbc.sql("delete from search_miss").update();
		}
		else {
			jdbc.sql("delete from search_miss where term = :term").param("term", normalize(term)).update();
		}
	}

	private boolean isRepeat(String term, Instant now) {
		Instant previous = recentlyNoted.put(term, now);
		if (recentlyNoted.size() > MAX_TERMS) {
			recentlyNoted.entrySet().removeIf(entry -> entry.getValue().isBefore(now.minus(REPEAT_WINDOW)));
		}
		if (recentlyNoted.size() > MAX_REMEMBERED) {
			recentlyNoted.clear();
		}
		return previous != null && previous.isAfter(now.minus(REPEAT_WINDOW));
	}

	/** "  Tarte   AUX pommes " becomes "tarte aux pommes". */
	static String normalize(String text) {
		String term = SPACES.matcher(text.strip()).replaceAll(" ").toLowerCase(Locale.FRENCH);
		return term.length() > MAX_LENGTH ? term.substring(0, MAX_LENGTH) : term;
	}

}
