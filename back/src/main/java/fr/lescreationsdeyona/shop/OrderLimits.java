package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Orders come from anyone: an address sends one a minute and {@link #PER_HOUR} an hour at most, the
 * whole site takes {@link #SITE_PER_HOUR} an hour. Remembered in memory only, never written.
 */
@Component
class OrderLimits {

	static final int PER_HOUR = 5;

	static final Duration MIN_INTERVAL = Duration.ofMinutes(1);

	static final int SITE_PER_HOUR = 30;

	/** Questions to Google for an address: more than orders, a checkbox can expire and be ticked again. */
	static final int CHECKS_PER_HOUR = 20;

	private final Map<String, Deque<Instant>> sentBy = new ConcurrentHashMap<>();

	private final Map<String, Deque<Instant>> checkedBy = new ConcurrentHashMap<>();

	private final Deque<Instant> sentBySite = new ArrayDeque<>();

	/** Each answer checked is a call to Google, sent for anyone who posts. */
	boolean tooManyChecks(String sender, Instant now) {
		Deque<Instant> times = checkedBy.computeIfAbsent(sender, key -> new ArrayDeque<>());
		synchronized (times) {
			dropBefore(times, now.minus(Duration.ofHours(1)));
			if (times.size() >= CHECKS_PER_HOUR) {
				return true;
			}
			times.addLast(now);
			return false;
		}
	}

	/** Why an order of this sender is refused now, or null. An accepted one is counted. */
	@Nullable ErrorCode refusal(String sender, Instant now) {
		Instant hourAgo = now.minus(Duration.ofHours(1));
		Deque<Instant> times = sentBy.computeIfAbsent(sender, key -> new ArrayDeque<>());
		synchronized (times) {
			dropBefore(times, hourAgo);
			if (!times.isEmpty() && times.peekLast().isAfter(now.minus(MIN_INTERVAL))) {
				return ErrorCode.SHOP_TOO_FAST;
			}
			if (times.size() >= PER_HOUR) {
				return ErrorCode.SHOP_TOO_MANY;
			}
			synchronized (sentBySite) {
				dropBefore(sentBySite, hourAgo);
				if (sentBySite.size() >= SITE_PER_HOUR) {
					return ErrorCode.SHOP_BUSY;
				}
				sentBySite.addLast(now);
			}
			times.addLast(now);
			return null;
		}
	}

	/** Every hour, the addresses not heard from for an hour. */
	@Scheduled(initialDelay = 3_600_000, fixedDelay = 3_600_000)
	void forgetSenders() {
		Instant hourAgo = Instant.now().minus(Duration.ofHours(1));
		forgetSilent(sentBy, hourAgo);
		forgetSilent(checkedBy, hourAgo);
	}

	private static void forgetSilent(Map<String, Deque<Instant>> byAddress, Instant hourAgo) {
		byAddress.values().removeIf(times -> {
			synchronized (times) {
				return times.isEmpty() || times.peekLast().isBefore(hourAgo);
			}
		});
	}

	private static void dropBefore(Deque<Instant> times, Instant limit) {
		while (!times.isEmpty() && times.peekFirst().isBefore(limit)) {
			times.pollFirst();
		}
	}

}
