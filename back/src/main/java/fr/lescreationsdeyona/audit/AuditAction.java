package fr.lescreationsdeyona.audit;

/** What was done, shown in French by the back-office. */
public enum AuditAction {
	CREATED, UPDATED,
	/** Moved to the trash. */
	TRASHED,
	/** Deleted for good, without going through the trash (an appearance preset, a visitor's message). */
	DELETED,
	/** Taken out of the trash. */
	RESTORED,
	/** Erased from the trash. */
	ERASED,
	/** A scheduled recipe, published by the site. */
	PUBLISHED,
	/** Ingredients merged into one. */
	MERGED,
	/** A backup downloaded, or sent to Google Drive at once. */
	EXPORTED,
	/** A backup restored. */
	IMPORTED,
	/** Google Drive connected or disconnected. */
	CONNECTED, DISCONNECTED
}
