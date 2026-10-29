package fr.lescreationsdeyona.menu;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A menu in the trash, as JSON: its recipes by id, and by URL to find one put in the trash and
 * restored meanwhile (it gets a new id). {@code imageId}: the photo chosen for it (1.7; absent
 * from menus put in the trash before).
 */
record TrashedMenu(String title, String slug, @Nullable String intro, boolean published, Instant createdAt,
		List<RecipeRef> recipes, @Nullable UUID imageId) {

	record RecipeRef(Long id, String slug) {
	}

}
