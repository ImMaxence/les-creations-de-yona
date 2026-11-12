package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.live.TypingRelay;
import fr.lescreationsdeyona.message.MessageResponses.Typist;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * "est en train d'écrire…": who writes in which group, kept a few seconds in memory. Told at once
 * through the WebSocket of the back-office (AdminLive); read by the pages whose WebSocket is cut, which
 * ask every few seconds. Nothing written in the database: it says nothing once the moment has passed.
 */
@Component
class MessageTyping implements TypingRelay {

	/** As long as the pages show it after the last key. */
	static final Duration SHOWN = Duration.ofSeconds(5);

	private record Writing(@Nullable String name, Instant at) {
	}

	private final Map<Long, Map<String, Writing>> groups = new ConcurrentHashMap<>();

	private final AdminGroups adminGroups;

	private final Clock clock;

	@Autowired
	MessageTyping(AdminGroups adminGroups) {
		this(adminGroups, Clock.systemUTC());
	}

	MessageTyping(AdminGroups adminGroups, Clock clock) {
		this.adminGroups = adminGroups;
		this.clock = clock;
	}

	@Override
	public Set<String> writing(long groupId, String writerEmail, @Nullable String writerName) {
		String writer = writerEmail.toLowerCase(Locale.ROOT);
		Set<String> members = adminGroups.audience(groupId, writer);
		if (!members.isEmpty()) {
			groups.computeIfAbsent(groupId, id -> new ConcurrentHashMap<>()).put(writer, new Writing(writerName, clock.instant()));
		}
		return members;
	}

	/** Those writing in the group now, {@code reader} left out. */
	List<Typist> writers(long groupId, String reader) {
		Map<String, Writing> writing = groups.get(groupId);
		if (writing == null) {
			return List.of();
		}
		Instant since = clock.instant().minus(SHOWN);
		writing.values().removeIf(entry -> entry.at().isBefore(since));
		return writing.entrySet()
			.stream()
			.filter(entry -> !entry.getKey().equalsIgnoreCase(reader))
			.map(entry -> new Typist(entry.getKey(), entry.getValue().name()))
			.sorted((a, b) -> a.email().compareTo(b.email()))
			.toList();
	}

	/** Their message sent: no longer writing. */
	void sent(long groupId, String writerEmail) {
		Map<String, Writing> writing = groups.get(groupId);
		if (writing != null) {
			writing.remove(writerEmail.toLowerCase(Locale.ROOT));
		}
	}

}
