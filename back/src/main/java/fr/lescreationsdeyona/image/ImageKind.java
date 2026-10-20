package fr.lescreationsdeyona.image;

public enum ImageKind {

	RECIPE("recipes"),
	CATEGORY("categories");

	/** Top-level S3 folder of this kind of image. */
	private final String folder;

	ImageKind(String folder) {
		this.folder = folder;
	}

	String folder() {
		return folder;
	}

}
