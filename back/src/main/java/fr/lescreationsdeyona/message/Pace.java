package fr.lescreationsdeyona.message;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * How often an admin may do something (send photos, have pages read for previews): {@code max} times in
 * a sliding {@code window}, counted in memory, per admin. A restart forgets it: a limit against a storm,
 * not an account.
 */
final class Pace {

	private final int max;

	private final Duration window;

	private final Clock clock;

	private final Map<String, Deque<Instant>> times = new ConcurrentHashMap<>();

	Pace(int max, Duration window, Clock clock) {
		this.max = max;
		this.window = window;
		this.clock = clock;
	}

	/** True, and counted, when {@code who} may do it once more now. */
	boolean allow(String who) {
		Instant now = clock.instant();
		Deque<Instant> done = times.computeIfAbsent(who, key -> new ArrayDeque<>());
		synchronized (done) {
			while (!done.isEmpty() && !done.peekFirst().isAfter(now.minus(window))) {
				done.pollFirst();
			}
			if (done.size() >= max) {
				return false;
			}
			done.addLast(now);
			return true;
		}
	}

}
