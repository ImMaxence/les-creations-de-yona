package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.SearchWords;
import fr.lescreationsdeyona.common.Texts;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BiFunction;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/** Recipe search criteria. User input is always a bound parameter, never concatenated into SQL. */
final class RecipeSpecifications {

	private static final char LIKE_ESCAPE = '\\';

	private RecipeSpecifications() {
	}

	static Specification<Recipe> matching(RecipeFilter filter) {
		List<Specification<Recipe>> criteria = new ArrayList<>();
		RecipeStatus status = filter.status();
		if (status != null) {
			criteria.add((recipe, query, cb) -> cb.equal(recipe.get("status"), status));
		}
		String categorySlug = filter.categorySlug();
		if (StringUtils.hasText(categorySlug)) {
			// One row per recipe: a recipe is in a category once at most.
			criteria.add((recipe, query, cb) -> cb.equal(recipe.join("categories").get("slug"), categorySlug));
		}
		String tagSlug = filter.tagSlug();
		if (StringUtils.hasText(tagSlug)) {
			// One row per recipe: a recipe has a tag once at most.
			criteria.add((recipe, query, cb) -> cb.equal(recipe.join("tags").get("slug"), tagSlug));
		}
		String titleQuery = filter.titleQuery();
		if (StringUtils.hasText(titleQuery)) {
			criteria.add(titleContains(titleQuery.strip()));
		}
		String text = filter.text();
		RecipeTheme theme = filter.theme();
		Integer maxMinutes = filter.maxMinutes();
		if (StringUtils.hasText(text)) {
			// Each word somewhere: "chocolat dessert" finds a recipe with chocolate in the desserts
			SearchWords.of(text).forEach(word -> criteria.add(mentions(word, true)));
			String typed = SearchWords.theme(text);
			if (theme == null && typed != null) {
				criteria.add(themeTyped(RecipeTheme.valueOf(typed)));
			}
			// "tarte en 30 min": the time filter, unless a shorter one is chosen
			Integer typedMinutes = SearchWords.maxMinutes(text);
			if (typedMinutes != null && (maxMinutes == null || typedMinutes < maxMinutes)) {
				maxMinutes = typedMinutes;
			}
			if (SearchWords.quick(text)) {
				criteria.add(anyOf(takesAtMost(SearchWords.QUICK_MINUTES), mentions("rapide", false), mentions("express", false)));
			}
			if (SearchWords.easy(text)) {
				criteria.add(anyOf((recipe, query, cb) -> cb.between(recipe.get("difficulty"), DifficultyLevel.EASY.min(),
						DifficultyLevel.EASY.max()), mentions("facile", false), mentions("simple", false)));
			}
			if (SearchWords.noCooking(text)) {
				criteria.add(anyOf(withoutCooking(), mentions("sans cuisson", true)));
			}
		}
		if (theme != null) {
			criteria.add((recipe, query, cb) -> cb.equal(recipe.get("theme"), theme));
		}
		// Each one: "œufs + chocolat" finds the recipes having both
		for (String ingredientName : filter.ingredientNames()) {
			if (StringUtils.hasText(ingredientName)) {
				String name = ingredientName.strip();
				criteria.add(hasIngredient((line, cb) -> cb.equal(line.get("ingredient").get("name"), name)));
			}
		}
		UUID imageId = filter.imageId();
		if (imageId != null) {
			criteria.add((recipe, query, cb) -> cb.or(cb.equal(recipe.get("image").get("id"), imageId),
					cb.equal(recipe.get("pinterestImage").get("id"), imageId)));
		}
		Long ingredientId = filter.ingredientId();
		if (ingredientId != null) {
			criteria.add(hasIngredient((line, cb) -> cb.equal(line.get("ingredient").get("id"), ingredientId)));
		}
		if (maxMinutes != null) {
			criteria.add(takesAtMost(maxMinutes));
		}
		Boolean scheduled = filter.scheduled();
		if (scheduled != null) {
			criteria.add((recipe, query, cb) -> scheduled ? cb.isNotNull(recipe.get("scheduledAt")) : cb.isNull(recipe.get("scheduledAt")));
		}
		DifficultyLevel difficulty = filter.difficulty();
		if (difficulty != null) {
			criteria.add((recipe, query, cb) -> cb.between(recipe.get("difficulty"), difficulty.min(), difficulty.max()));
		}
		return Specification.allOf(criteria);
	}

	/** Preparation, rest and cooking, a missing one counting as 0; preparation or cooking is given. */
	private static Specification<Recipe> takesAtMost(int minutes) {
		return (recipe, query, cb) -> {
			Expression<Integer> prep = recipe.get("prepMinutes");
			Expression<Integer> cook = recipe.get("cookMinutes");
			Expression<Integer> rest = recipe.get("restMinutes");
			Expression<Integer> total = cb.sum(cb.sum(cb.coalesce(prep, 0), cb.coalesce(cook, 0)), cb.coalesce(rest, 0));
			return cb.and(cb.or(cb.isNotNull(prep), cb.isNotNull(cook)), cb.le(total, minutes));
		};
	}

	/** A cooking time of 0, or none given while the preparation time is (a recipe without times is unknown). */
	private static Specification<Recipe> withoutCooking() {
		return (recipe, query, cb) -> {
			Expression<Integer> cook = recipe.get("cookMinutes");
			return cb.or(cb.equal(cook, 0), cb.and(cb.isNull(cook), cb.isNotNull(recipe.get("prepMinutes"))));
		};
	}

	@SafeVarargs
	private static Specification<Recipe> anyOf(Specification<Recipe>... specifications) {
		return Specification.anyOf(specifications);
	}

	/** Case- and accent-insensitive: "creme" finds "Crème brûlée". */
	private static Specification<Recipe> titleContains(String text) {
		// A plain value is sent as a bound parameter; cb.literal() would be inlined into the SQL.
		String pattern = containsPattern(text);
		return (recipe, query, cb) -> cb.like(folded(cb, recipe.get("title")), pattern, LIKE_ESCAPE);
	}

	/**
	 * "salé" typed: the savory recipes, but also a sweet one that says it ("Caramel au beurre salé",
	 * the ingredient "Beurre salé"); a theme typed is not a filter, the visitor may mean the word.
	 * "sucré": the sweet ones, or a title, category or tag saying it, the ingredient "Sucre" left out
	 * (any recipe may have some).
	 */
	private static Specification<Recipe> themeTyped(RecipeTheme theme) {
		Specification<Recipe> sayingIt = theme == RecipeTheme.SAVORY ? mentions("sale", true) : mentions("sucre", false);
		return (recipe, query, cb) -> cb.or(cb.equal(recipe.get("theme"), theme), sayingIt.toPredicate(recipe, query, cb));
	}

	/**
	 * A folded word in its title, one of its categories or tags, or (unless left out) its content:
	 * ingredients, equipment, steps ("moule à manqué", "bain-marie"). Subqueries rather than joins:
	 * each recipe comes out once.
	 */
	private static Specification<Recipe> mentions(String word, boolean inContent) {
		String pattern = "%" + word + "%";
		return (recipe, query, cb) -> {
			Subquery<Integer> steps = query.subquery(Integer.class);
			Root<RecipePart> part = steps.from(RecipePart.class);
			Join<RecipePart, RecipeStep> step = part.join("steps");
			steps.select(cb.literal(1))
				.where(cb.equal(part.get("recipe"), recipe), cb.like(folded(cb, step.get("description")), pattern));
			Subquery<Integer> categories = query.subquery(Integer.class);
			Root<Recipe> inCategory = categories.correlate(recipe);
			categories.select(cb.literal(1))
				.where(cb.like(folded(cb, inCategory.join("categories").get("name")), pattern));
			Subquery<Integer> tags = query.subquery(Integer.class);
			Root<Recipe> withTag = tags.correlate(recipe);
			tags.select(cb.literal(1)).where(cb.like(folded(cb, withTag.join("tags").get("name")), pattern));
			Subquery<Integer> lines = query.subquery(Integer.class);
			Root<RecipeIngredient> line = lines.from(RecipeIngredient.class);
			lines.select(cb.literal(1))
				.where(cb.equal(line.get("part").get("recipe"), recipe),
						cb.like(folded(cb, line.get("ingredient").get("name")), pattern));
			Predicate named = cb.or(cb.like(folded(cb, recipe.get("title")), pattern), cb.exists(categories), cb.exists(tags));
			return inContent
					? cb.or(named, cb.exists(lines), cb.like(folded(cb, recipe.get("equipment")), pattern), cb.exists(steps))
					: named;
		};
	}

	/**
	 * A subquery rather than a join: a recipe listing the ingredient in several parts still comes
	 * out once.
	 */
	private static Specification<Recipe> hasIngredient(
			BiFunction<Root<RecipeIngredient>, CriteriaBuilder, Predicate> condition) {
		return (recipe, query, cb) -> {
			Subquery<Integer> lines = query.subquery(Integer.class);
			Root<RecipeIngredient> line = lines.from(RecipeIngredient.class);
			lines.select(cb.literal(1))
				.where(cb.equal(line.get("part").get("recipe"), recipe), condition.apply(line, cb));
			return cb.exists(lines);
		};
	}

	private static Expression<String> folded(CriteriaBuilder cb, Expression<String> text) {
		return cb.function("unaccent", String.class, cb.lower(text));
	}

	private static String containsPattern(String text) {
		return "%" + escapeLikeWildcards(Texts.foldCaseAndAccents(text)) + "%";
	}

	/** "100%" searches for a literal "100%", not for "100" followed by anything. */
	private static String escapeLikeWildcards(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
