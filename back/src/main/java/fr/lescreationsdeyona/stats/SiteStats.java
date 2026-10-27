package fr.lescreationsdeyona.stats;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.search.SearchMissService;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Figures of the back-office dashboard, computed on request. */
public record SiteStats(Recipes recipes, long categories, Ingredients ingredients, Images images,
		@Schema(description = "Every category, the fullest first; a recipe counts in each of its categories")
		List<NamedCount> recipesPerCategory,
		@Schema(description = "The 8 ingredients in the most recipes") List<NamedCount> topIngredients,
		@Schema(description = "The 10 published recipes the most viewed, among those viewed at least once")
		List<ViewedRecipe> mostViewedRecipes,
		@Schema(description = "Recipes created each month, the last 12 months (Paris time), oldest first")
		List<MonthCount> recipesPerMonth,
		Storage storage,
		@Schema(description = "Recipes lacking what Google shows best: published ones first, the most incomplete first (100 at most)")
		List<IncompleteRecipe> incompleteRecipes,
		@Schema(description = "Drafts not changed for 30 days, the oldest first (50 at most)")
		List<DatedRecipe> staleDrafts,
		@Schema(description = "Published recipes not changed for 12 months, the oldest first (50 at most)")
		List<DatedRecipe> outdatedRecipes,
		@Schema(description = "What visitors searched for without finding any recipe, the most searched first (30 at most)")
		List<SearchMissService.SearchMiss> searchMisses,
		@Schema(description = "Browsers notified of new recipes") long notificationSubscribers,
		@Schema(description = "Recipes, categories, menus and photos in the trash, erased 30 days after their deletion")
		long trashedItems,
		@Schema(description = "Words of the glossary") long glossaryTerms,
		Instant computedAt) {

	public enum MissingField {
		PHOTO, INTRO, TIME, SERVINGS, DIFFICULTY
	}

	public record IncompleteRecipe(Long id, String title, RecipeStatus status, List<MissingField> missing) {
	}

	public record DatedRecipe(Long id, String title, Instant updatedAt) {
	}

	public record ViewedRecipe(Long id, String title, long viewCount) {
	}

	public record Recipes(long total, long published, long drafts, long withoutPhoto, long withVideo,
			@Schema(description = "With several parts, or a titled one") long inParts, long createdLast30Days,
			@Schema(description = "Drafts with a scheduled publication") long scheduled,
			@Schema(description = "Visits of the recipe pages, the admins' own left out") long views,
			@Nullable Instant lastUpdate) {
	}

	public record Ingredients(long total, long unused) {
	}

	public record Images(long total, long unused) {
	}

	public record NamedCount(String name, long count) {
	}

	/** {@code month}: "2026-10". */
	public record MonthCount(String month, long count) {
	}

	/**
	 * Bytes. The disk is the one of the server running the containers: the database and the
	 * images live on it, with everything else the server holds.
	 */
	public record Storage(
			@Schema(description = "Every file of the image bucket; absent when the storage cannot be reached")
			@Nullable Long imageBytes,
			@Nullable Long imageFiles, long databaseBytes, long diskTotalBytes, long diskFreeBytes) {
	}

}
