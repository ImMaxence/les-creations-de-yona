package fr.lescreationsdeyona.live;

import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * An admin writes in a group: kept a few seconds for the pages that ask (their WebSocket cut), and
 * the members to tell, the writer included; none when the writer is not one of them (or the group is
 * gone). Given by the messages (MessageTyping).
 */
@FunctionalInterface
public interface TypingRelay {

	Set<String> writing(long groupId, String writerEmail, @Nullable String writerName);

}
