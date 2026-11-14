package fr.lescreationsdeyona.message;

import java.time.Instant;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * A line written in a group, by a member changing it ("Léa a ajouté Sam") or by the site itself (a new version): its
 * notification on the devices of the members, once committed (MessagePush, 2.18). {@code members}: those told, the
 * member removed by the line included.
 */
record LineWritten(long id, long groupId, String groupName, GroupEvent event, @Nullable String value, String actorEmail,
		@Nullable String actorName, Instant sentAt, Set<String> members) {
}
