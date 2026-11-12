package fr.lescreationsdeyona.message;

import java.time.Instant;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** A message written in a group (not a line of the group): its notification, once committed (MessagePush). */
record MessageSent(long id, long groupId, String groupName, String authorEmail, @Nullable String authorName, String body, int photos,
		Instant sentAt, Set<String> members) {
}
