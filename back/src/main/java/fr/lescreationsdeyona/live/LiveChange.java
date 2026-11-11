package fr.lescreationsdeyona.live;

/**
 * Published where something changes a badge of the back-office menu; sent to the admins connected
 * once the transaction is committed (see AdminLive), so that the count they ask again includes it.
 */
public record LiveChange(LiveTopic topic) {
}
