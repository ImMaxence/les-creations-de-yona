package fr.lescreationsdeyona.live;

/** What changed, for the badges of the back-office menu: each admin asks its own count again. */
public enum LiveTopic {
	/** "Retours": a visitor's message came, or messages were read or deleted. */
	FEEDBACK,
	/** "Commandes": an order came, or one was handled. */
	ORDERS,
	/** "Historique": something was done in the back-office. */
	HISTORY,
	/** "Corbeille": something was put there, restored or erased. */
	TRASH,
	/** "Journaux": a new error was written. */
	LOGS,
	/** "Messages": an admin wrote to the others, or deleted a message. */
	MESSAGES,
	/** "Messages": an admin opened the back-office, or left it: the green dot of the others. */
	PRESENCE
}
