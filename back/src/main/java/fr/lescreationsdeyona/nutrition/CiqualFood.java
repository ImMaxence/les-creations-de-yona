package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** A food of the Ciqual table: "Beurre à 80% MG minimum, doux", and what 100 g of it hold. */
public record CiqualFood(@Schema(description = "Code of the food in the Ciqual table, the same from one version to the next") int code,
		String name,
		@Schema(description = "Ciqual sub-group, 4 digits: \"0901\" for butters") String subgroupCode,
		@Schema(description = "\"beurres\"; absent when the table names none") @Nullable String subgroupName,
		@Schema(description = "Per 100 g; a constituent the table does not give counts as 0") NutritionFacts per100g) {

	/** Vegetables, legumes and fruits: what the Nutri-Score counts in their favour (not potatoes, nor nuts). */
	private static final Set<String> FRUITS_VEGETABLES_LEGUMES = Set.of("0201", "0203", "0204");

	boolean isFruitVegetableOrLegume() {
		return FRUITS_VEGETABLES_LEGUMES.contains(subgroupCode);
	}

}
