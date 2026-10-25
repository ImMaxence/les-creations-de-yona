package fr.lescreationsdeyona.image;

public enum ImageKind {

	RECIPE("recipes"),
	CATEGORY("categories"),
	/** Uploaded from the gallery page, shown nowhere until chosen for a recipe or a category. */
	GALLERY("gallery"),
	/** Uploaded for the "À propos" section of the home page. */
	SITE("site");

	/** Top-level S3 folder of this kind of image. */
	private final String folder;

	ImageKind(String folder) {
		this.folder = folder;
	}

	String folder() {
		return folder;
	}

}
