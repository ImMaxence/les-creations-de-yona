package fr.lescreationsdeyona.live;

import java.util.Set;

/**
 * Who may read that an admin is writing in a group: its members, the writer included; empty when the
 * writer is not one of them (or the group is gone). Given by the messages (AdminGroups).
 */
@FunctionalInterface
public interface TypingAudience {

	Set<String> of(long groupId, String writerEmail);

}
