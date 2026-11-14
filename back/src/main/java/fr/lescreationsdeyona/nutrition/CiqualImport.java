package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** What the import of a new Ciqual table did. */
public record CiqualImport(String version,
		@Schema(description = "Foods in the table now") int foodCount,
		@Schema(description = "Foods the table before did not have") int added,
		@Schema(description = "Foods of the table before, gone") int removed,
		@Schema(description = "Ingredients that were one of the foods gone, by name: to be linked again") List<String> unlinkedIngredients) {
}
