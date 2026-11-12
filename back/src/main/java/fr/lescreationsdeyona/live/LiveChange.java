package fr.lescreationsdeyona.live;

import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * Published where something changes a badge of the back-office menu; sent to the admins connected
 * once the transaction is committed (see AdminLive), so that the count they ask again includes it.
 * {@code audience}: the emails of the admins it concerns (the members of a group), null for all.
 */
public record LiveChange(LiveTopic topic, @Nullable Set<String> audience) {

	public LiveChange(LiveTopic topic) {
		this(topic, null);
	}

}
