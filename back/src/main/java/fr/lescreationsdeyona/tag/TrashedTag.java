package fr.lescreationsdeyona.tag;

import java.util.List;

/** A tag in the trash, as JSON; its recipes by id, and by URL to find one restored meanwhile. */
record TrashedTag(String name, String slug) {

	/** The recipes carrying it when deleted: given it back on restore. */
	record Links(List<RecipeRef> recipes) {

		static final Links NONE = new Links(List.of());

	}

	record RecipeRef(Long id, String slug) {
	}

}
