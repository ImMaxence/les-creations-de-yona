package fr.lescreationsdeyona.recipe;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * Recipes used as a part of another ("Pâte sablée" in a tart). Unfolded for the site into plain parts,
 * quantities multiplied: the total of the ingredients, the cooking mode, the shopping list, the Markdown
 * pages and the structured data then have nothing to know about it.
 */
final class LinkedRecipes {

	/** A tart, its cream, and the custard of that cream: no further. */
	static final int MAX_LEVELS = 3;

	private LinkedRecipes() {
	}

	/** The recipe as visitors read it; {@code detail} itself when it links no other. */
	static RecipeDetail unfold(Recipe recipe, RecipeDetail detail, RecipeMapper mapper) {
		if (recipe.getParts().stream().allMatch(part -> part.getLinkedRecipe() == null)) {
			return detail;
		}
		List<RecipeDetail.Part> parts = new ArrayList<>();
		Map<String, String> equipment = new LinkedHashMap<>();
		detail.equipment().forEach(item -> equipment.putIfAbsent(item.toLowerCase(Locale.ROOT), item));
		Set<Long> path = new HashSet<>();
		path.add(recipe.getId());
		for (RecipePart part : recipe.getParts()) {
			unfold(part, BigDecimal.ONE, null, null, path, parts, equipment, mapper);
		}
		return detail.unfolded(parts, List.copyOf(equipment.values()));
	}

	/** {@code path}: the recipes being unfolded, so that faulty data looping on itself still ends. */
	private static void unfold(RecipePart part, BigDecimal ratio, @Nullable String prefix,
			RecipeDetail.@Nullable LinkedRecipe origin, Set<Long> path, List<RecipeDetail.Part> parts,
			Map<String, String> equipment, RecipeMapper mapper) {
		Recipe linked = part.getLinkedRecipe();
		if (linked == null) {
			RecipeDetail.Part mapped = mapper.toPart(part);
			parts.add(new RecipeDetail.Part(joined(prefix, part.getTitle()),
					mapped.ingredients().stream().map(line -> times(line, ratio)).toList(), mapped.steps(), origin));
			return;
		}
		if (!path.add(linked.getId())) {
			return;
		}
		BigDecimal linkedRatio = ratio.multiply(part.getLinkedRatio());
		String title = joined(prefix, part.getTitle() == null ? linked.getTitle() : part.getTitle());
		RecipeDetail.LinkedRecipe from = origin != null ? origin
				: new RecipeDetail.LinkedRecipe(linked.getId(), linked.getTitle(), linked.getSlug(),
						linked.getMainCategory().getSlug(), linked.getStatus(), linkedRatio);
		if (linked.getEquipment() != null) {
			linked.getEquipment().lines().filter(line -> !line.isBlank())
				.forEach(item -> equipment.putIfAbsent(item.toLowerCase(Locale.ROOT), item));
		}
		for (RecipePart linkedPart : linked.getParts()) {
			unfold(linkedPart, linkedRatio, title, from, path, parts, equipment, mapper);
		}
		path.remove(linked.getId());
	}

	/** "Pâte feuilletée · Détrempe"; the title of the recipe alone for its single untitled part. */
	private static @Nullable String joined(@Nullable String prefix, @Nullable String title) {
		if (prefix == null) {
			return title;
		}
		return title == null ? prefix : prefix + " · " + title;
	}

	private static RecipeDetail.IngredientLine times(RecipeDetail.IngredientLine line, BigDecimal ratio) {
		if (line.quantity() == null || ratio.compareTo(BigDecimal.ONE) == 0) {
			return line;
		}
		return new RecipeDetail.IngredientLine(line.name(), line.quantity().multiply(ratio).setScale(2, RoundingMode.HALF_UP),
				line.unit(), line.note(), line.piece());
	}

	/** Levels below a recipe, itself included: 1 for a recipe that links no other. */
	static int levelsBelow(Recipe recipe) {
		return levelsBelow(recipe, new HashSet<>());
	}

	private static int levelsBelow(Recipe recipe, Set<Long> seen) {
		if (!seen.add(recipe.getId())) {
			return 0;
		}
		int deepest = 0;
		for (RecipePart part : recipe.getParts()) {
			if (part.getLinkedRecipe() != null) {
				deepest = Math.max(deepest, levelsBelow(part.getLinkedRecipe(), seen));
			}
		}
		seen.remove(recipe.getId());
		return 1 + deepest;
	}

	/** Whether {@code recipe} reaches {@code targetId} through its linked recipes. */
	static boolean reaches(Recipe recipe, long targetId) {
		return reaches(recipe, targetId, new HashSet<>());
	}

	private static boolean reaches(Recipe recipe, long targetId, Set<Long> seen) {
		if (recipe.getId() == targetId) {
			return true;
		}
		if (!seen.add(recipe.getId())) {
			return false;
		}
		return recipe.getParts().stream()
			.map(RecipePart::getLinkedRecipe)
			.filter(Objects::nonNull)
			.anyMatch(linked -> reaches(linked, targetId, seen));
	}

}
