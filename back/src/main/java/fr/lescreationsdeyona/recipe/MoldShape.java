package fr.lescreationsdeyona.recipe;

/** Shape of the mold a recipe is written for; quantities follow the area of the visitor's mold. */
public enum MoldShape {
	/** Its diameter. */
	ROUND,
	/** Its side. */
	SQUARE,
	/** Its length and width. */
	RECTANGLE
}
