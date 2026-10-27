package fr.lescreationsdeyona.menu;

import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * A menu in the trash, as JSON: its recipes by id, and by URL to find one put in the trash and
 * restored meanwhile (it gets a new id).
 */
record TrashedMenu(String title, String slug, @Nullable String intro, boolean published, Instant createdAt,
		List<RecipeRef> recipes) {

	record RecipeRef(Long id, String slug) {
	}

}
