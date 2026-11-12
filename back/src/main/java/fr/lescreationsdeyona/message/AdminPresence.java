package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.live.AdminLive;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Who is in the back-office now, the green dot of "Messages", as in a team's chat: an admin with a page
 * of the back-office open (its WebSocket, AdminLive), or, that one cut by a proxy, whose page asked for
 * news a moment ago (it does so every few seconds without its WebSocket). Nothing written in the base:
 * forgotten when the server starts again, the pages telling it again at once.
 */
@Component
public class AdminPresence {

	/** A page without WebSocket asks every 4 seconds, every 16 in a hidden tab: a minute without a word, gone. */
	static final Duration SEEN_FOR = Duration.ofMinutes(1);

	private final AdminLive live;

	private final Clock clock;

	/** The last word of the pages without WebSocket, by admin. */
	private final Map<String, Instant> lastSeen = new ConcurrentHashMap<>();

	@Autowired
	public AdminPresence(AdminLive live) {
		this(live, Clock.systemUTC());
	}

	AdminPresence(AdminLive live, Clock clock) {
		this.live = live;
		this.clock = clock;
	}

	/** A page of this admin asked for news: there a minute more; the others told if they did not see it. */
	public void seen(String email) {
		String admin = email.toLowerCase(Locale.ROOT);
		Instant now = clock.instant();
		boolean arrives = !live.online().contains(admin) && !recent(lastSeen.get(admin), now);
		lastSeen.put(admin, now);
		if (arrives) {
			live.tellPresence();
		}
	}

	/** The admins there now, in alphabetical order. */
	public List<String> online() {
		Instant now = clock.instant();
		lastSeen.values().removeIf(seen -> !recent(seen, now));
		Set<String> there = new TreeSet<>(live.online());
		there.addAll(lastSeen.keySet());
		return List.copyOf(there);
	}

	private static boolean recent(Instant seen, Instant now) {
		return seen != null && seen.isAfter(now.minus(SEEN_FOR));
	}

}
