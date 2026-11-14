package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.ingredient.IngredientPiece;
import fr.lescreationsdeyona.nutrition.NutriScoreKind;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import fr.lescreationsdeyona.tag.TagResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A full recipe: public recipe page, and back-office edit form. */
public record RecipeDetail(Long id, String title, String slug, @Nullable String intro, RecipeStatus status,
		RecipeTheme theme, boolean featured,
		@Schema(description = "Its nutrition facts shown on its page; absent from a copy kept before 2.15 (not shown)")
		@Nullable Boolean showNutrition,
		@Schema(description = "Weight of the whole recipe once cooked, in grams; absent: the raw weight") @Nullable Integer cookedGrams,
		@Schema(description = "The grid of its Nutri-Score; absent from a copy kept before 2.17 (GENERAL)") @Nullable NutriScoreKind nutriScoreKind,
		@Schema(description = "Why its scheduled publication did not happen; a failed recipe only") @Nullable String publicationFailure,
		@Schema(description = "At least one; the first one is the main category, in the recipe URL")
		List<CategoryResponse> categories,
		@Schema(description = "Sorted by name; empty when none") List<TagResponse> tags,
		@Nullable Integer servings, @Nullable Integer prepMinutes, @Nullable Integer cookMinutes,
		@Schema(description = "Resting, rising…, counted in the total time") @Nullable Integer restMinutes,
		@Schema(description = "From 1 to 5, by half points") @Nullable BigDecimal difficulty,
		@Schema(description = "Id of the YouTube video shown at the bottom of the recipe") @Nullable String youtubeVideoId,
		@Schema(description = "\"Le conseil de Yona\", Markdown rendered by the front") @Nullable String tip,
		@Schema(description = "Equipment needed (moule à tarte, fouet…), in order; empty when none") List<String> equipment,
		@Schema(description = "\"Questions fréquentes\", in order; empty when none") List<RecipeQuestion> questions,
		@Schema(description = "Mold the quantities are written for") @Nullable Mold mold,
		@Nullable UUID imageId,
		@Schema(description = "Vertical photo for Pinterest; absent: the main photo is offered") @Nullable UUID pinterestImageId,
		@Schema(description = "At least one: a recipe without parts has a single, untitled one")
		List<Part> parts,
		Instant createdAt, Instant updatedAt,
		@Schema(description = "First publication; absent for a recipe never published") @Nullable Instant publishedAt,
		@Schema(description = "A draft to be published at that time; for a failed recipe, the time it was planned")
		@Nullable Instant scheduledAt,
		@Schema(description = "Computed from its ingredients: on the site when shown, in the back-office preview; absent otherwise")
		@Nullable RecipeNutrition nutrition) {

	/** The same recipe with its parts and equipment as the site shows them, linked recipes unfolded. */
	public RecipeDetail unfolded(List<Part> unfoldedParts, List<String> allEquipment) {
		return new RecipeDetail(id, title, slug, intro, status, theme, featured, showNutrition, cookedGrams, nutriScoreKind,
				publicationFailure, categories, tags,
				servings, prepMinutes, cookMinutes, restMinutes, difficulty, youtubeVideoId, tip, allEquipment, questions, mold, imageId,
				pinterestImageId, unfoldedParts, createdAt, updatedAt, publishedAt, scheduledAt, nutrition);
	}

	/** The recipe {@code r} with its nutrition facts. Static: MapStruct would take a method of one parameter for a setter. */
	public static RecipeDetail withNutrition(RecipeDetail r, RecipeNutrition facts) {
		return new RecipeDetail(r.id, r.title, r.slug, r.intro, r.status, r.theme, r.featured, r.showNutrition, r.cookedGrams,
				r.nutriScoreKind, r.publicationFailure,
				r.categories, r.tags, r.servings, r.prepMinutes, r.cookMinutes, r.restMinutes, r.difficulty, r.youtubeVideoId, r.tip,
				r.equipment, r.questions, r.mold, r.imageId, r.pinterestImageId, r.parts, r.createdAt, r.updatedAt, r.publishedAt,
				r.scheduledAt, facts);
	}

	/** Whether its page shows its nutrition facts. */
	public boolean showsNutrition() {
		return Boolean.TRUE.equals(showNutrition);
	}

	/**
	 * A part of the recipe (the dough, the filling…), with its own ingredients and steps. On the site a linked
	 * recipe is unfolded here, quantities included, so that the total, the cooking mode and the shopping list
	 * read it as any part; in the editor it stays one part without content.
	 */
	public record Part(@Schema(description = "Absent for the single part of a recipe without parts") @Nullable String title,
			List<IngredientLine> ingredients, List<Step> steps,
			@Schema(description = "The recipe this part comes from, when it is another recipe") @Nullable LinkedRecipe linkedRecipe) {

		public Part(@Nullable String title, List<IngredientLine> ingredients, List<Step> steps) {
			this(title, ingredients, steps, null);
		}

	}

	/** The recipe a part comes from, and how many times it is taken. */
	public record LinkedRecipe(Long id, String title, String slug,
			@Schema(description = "Main category, in the URL of its page") String categorySlug, RecipeStatus status,
			@Schema(description = "1 for the whole recipe, 0.5 for half of it") BigDecimal ratio) {
	}

	public record IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit,
			@Nullable String note,
			@Schema(description = "Weight of one piece, for \"400 g (≈ 8 œufs)\"") @Nullable IngredientPiece piece) {

		public IngredientLine(String name, @Nullable BigDecimal quantity, @Nullable String unit, @Nullable String note) {
			this(name, quantity, unit, note, null);
		}

	}

	/** Text or Markdown, rendered by the front. */
	public record Step(String description, @Nullable Integer durationMinutes,
			@Schema(description = "Ingredients the step needs, by position in its part's list (from 0); empty when it does not say")
			List<Integer> ingredientPositions) {
	}

	/** Width for a rectangle only; centimeters. */
	public record Mold(MoldShape shape, BigDecimal lengthCm, @Nullable BigDecimal widthCm) {
	}

}
