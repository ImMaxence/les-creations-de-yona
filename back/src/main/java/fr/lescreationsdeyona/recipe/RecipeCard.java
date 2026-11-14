package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.nutrition.ProteinClaim;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A recipe in a grid of cards (home page, recipes page). */
public record RecipeCard(String title, String slug, @Nullable UUID imageId, Instant createdAt,
		@Schema(description = "First publication: the date shown; absent only for cards kept in a browser before 1.1")
		@Nullable Instant publishedAt,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		@Schema(description = "Absent only for cards kept in a browser before 1.10") @Nullable RecipeTheme theme,
		@Schema(description = "Per serving, when its page shows its nutrition facts (complete, with servings); absent otherwise")
		@Nullable Nutrition nutrition) {

	/** The card {@code card} with its nutrition facts. Static: MapStruct would take a method of one parameter for a setter. */
	static RecipeCard withNutrition(RecipeCard card, @Nullable Nutrition nutrition) {
		return new RecipeCard(card.title, card.slug, card.imageId, card.createdAt, card.publishedAt, card.categories, card.theme,
				nutrition);
	}

	/** What a serving holds, said on its card: "450 kcal · 32 g de protéines". */
	@Schema(name = "RecipeCardNutrition")
	public record Nutrition(@Schema(description = "Energy of a serving, in kcal") double kcal,
			@Schema(description = "Proteins of a serving, in grams") double proteins,
			@Schema(description = "\"Source de protéines\" or \"Riche en protéines\"; absent below 12 % of its energy")
			@Nullable ProteinClaim proteinClaim,
			@Schema(description = "500 kcal a serving at most: a quarter of the 2 000 kcal of a day of reference") boolean light) {

		/** A light meal, as the calculator of the recipe page says: a quarter of the day at most. */
		static final double LIGHT_KCAL = 500;

		/** Of complete facts with servings. */
		static Nutrition of(RecipeNutrition nutrition) {
			double kcal = nutrition.perServing().kcal();
			return new Nutrition(kcal, nutrition.perServing().proteins(), nutrition.proteinClaim(), kcal <= LIGHT_KCAL);
		}

	}

}
