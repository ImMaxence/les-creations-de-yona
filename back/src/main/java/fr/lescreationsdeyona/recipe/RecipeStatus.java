package fr.lescreationsdeyona.recipe;

/** Only a published recipe is on the site. */
public enum RecipeStatus {
	DRAFT,
	PUBLISHED,
	/**
	 * A scheduled publication that could not happen (site down at that time, old backup restored,
	 * repeated errors): unpublished, with the reason, until published or scheduled again.
	 */
	FAILED
}
