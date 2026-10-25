package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Figures of the back-office dashboard, computed on request. */
public record SiteStats(Recipes recipes, long categories, Ingredients ingredients, Images images,
		@Schema(description = "Every category, the fullest first; a recipe counts in each of its categories")
		List<NamedCount> recipesPerCategory,
		@Schema(description = "The 8 ingredients in the most recipes") List<NamedCount> topIngredients,
		@Schema(description = "Recipes created each month, the last 12 months (Paris time), oldest first")
		List<MonthCount> recipesPerMonth,
		Storage storage, Instant computedAt) {

	public record Recipes(long total, long published, long drafts, long withoutPhoto, long withVideo,
			@Schema(description = "With several parts, or a titled one") long inParts, long createdLast30Days,
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
