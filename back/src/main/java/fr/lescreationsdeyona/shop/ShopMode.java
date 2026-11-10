package fr.lescreationsdeyona.shop;

/** Where the shop stands: set in the back-office. */
public enum ShopMode {

	/** Shown nowhere, takes no order. */
	CLOSED,

	/**
	 * For the people close to Yona, while she prepares her diploma: reached by its link only, out of
	 * the menu and of search engines, with a banner saying so.
	 */
	FRIENDS,

	/** Open to all, once the business is registered: in the menu and on the home page, without banner. */
	OPEN;

	/** Orders come in, for the close ones or for all. */
	public boolean takesOrders() {
		return this != CLOSED;
	}

}
