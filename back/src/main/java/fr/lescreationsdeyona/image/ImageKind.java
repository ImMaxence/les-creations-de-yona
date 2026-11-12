package fr.lescreationsdeyona.image;

public enum ImageKind {

	RECIPE("recipes"),
	CATEGORY("categories"),
	/** Uploaded from the gallery page, shown nowhere until chosen for a recipe or a category. */
	GALLERY("gallery"),
	/** Uploaded for the "À propos" section of the home page. */
	SITE("site"),
	/** Vertical photo of a recipe, offered to Pinterest by the "Épingler" button. */
	PINTEREST("pinterest"),
	/** Uploaded for a menu ("Menu de Noël"). */
	MENU("menus"),
	/** A photo of the receipt of an expense, in the accounts: never in the gallery, nor on the site. */
	RECEIPT("receipts"),
	/**
	 * A photo of the messages between the admins: sent in a message, of a group, or the image of a page
	 * a message links to. Never in the gallery, nor on the site: shown to the admins only.
	 */
	MESSAGE("messages");

	/** Kept apart from the gallery and the site, whatever their id. */
	public boolean isPrivate() {
		return this == RECEIPT || this == MESSAGE;
	}

	/** Top-level S3 folder of this kind of image. */
	private final String folder;

	ImageKind(String folder) {
		this.folder = folder;
	}

	/** Also the folders a backup archive may hold (BackupArchive). */
	public String folder() {
		return folder;
	}

}
