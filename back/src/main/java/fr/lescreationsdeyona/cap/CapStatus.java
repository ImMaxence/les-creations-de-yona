package fr.lescreationsdeyona.cap;

/**
 * Only a published article is on the site. A draft with a time of publication shows as "Programmé"
 * in the back-office: the backend publishes it then (see ScheduledCapPublication).
 */
public enum CapStatus {
	DRAFT,
	PUBLISHED,
	/**
	 * A scheduled publication that could not happen (site down at that time, repeated errors):
	 * unpublished, with the reason, until published or scheduled again.
	 */
	FAILED
}
