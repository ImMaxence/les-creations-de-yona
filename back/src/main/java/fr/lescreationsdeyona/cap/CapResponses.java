package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the API answers about "Mon CAP" and "Mes observations". */
public final class CapResponses {

	private CapResponses() {
	}

	public record CapEntryResponse(Long id, String title,
			@Schema(description = "Markdown rendered by the front") @Nullable String body, LocalDate happenedOn,
			@Nullable UUID imageId, boolean published, Instant updatedAt) {
	}

	public record ObservationResponse(Long id, String title,
			@Schema(description = "Markdown rendered by the front") String body, LocalDate observedOn, @Nullable UUID imageId,
			boolean published,
			@Schema(description = "Absent for \"Pas de recette\"; on the site, a recipe still in draft is absent too") @Nullable ObservationRecipe recipe,
			Instant updatedAt) {
	}

	public record ObservationRecipe(Long id, String title, String slug, String categorySlug, RecipeStatus status) {
	}

	/** A step in the trash, as JSON: its photo is kept beside it. */
	record TrashedCapEntry(String title, @Nullable String body, LocalDate happenedOn, boolean published) {
	}

	/** An observation in the trash, as JSON. {@code recipeId}: its recipe, if still there on restore. */
	record TrashedObservation(String title, String body, LocalDate observedOn, @Nullable Long recipeId, boolean published) {
	}

}
