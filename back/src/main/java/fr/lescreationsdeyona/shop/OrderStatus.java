package fr.lescreationsdeyona.shop;

/** Where an order stands, followed by the customer through their link. */
public enum OrderStatus {

	NEW, ACCEPTED, IN_PREPARATION, READY,
	/** Handed over: the money enters the accounts. */
	PICKED_UP,
	CANCELLED;

	boolean finished() {
		return this == PICKED_UP || this == CANCELLED;
	}

}
