package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.Texts;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
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
		String ingredientName = filter.ingredientName();
		if (StringUtils.hasText(ingredientName)) {
			String name = ingredientName.strip();
			criteria.add(hasIngredient((line, cb) -> cb.equal(line.get("ingredient").get("name"), name)));
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
		Integer maxMinutes = filter.maxMinutes();
		if (maxMinutes != null) {
			criteria.add(takesAtMost(maxMinutes));
		}
		DifficultyLevel difficulty = filter.difficulty();
		if (difficulty != null) {
			criteria.add((recipe, query, cb) -> cb.between(recipe.get("difficulty"), difficulty.min(), difficulty.max()));
		}
		return Specification.allOf(criteria);
	}

	/** Preparation plus cooking, a missing one counting as 0; at least one of them is given. */
	private static Specification<Recipe> takesAtMost(int minutes) {
		return (recipe, query, cb) -> {
			Expression<Integer> prep = recipe.get("prepMinutes");
			Expression<Integer> cook = recipe.get("cookMinutes");
			Expression<Integer> total = cb.sum(cb.coalesce(prep, 0), cb.coalesce(cook, 0));
			return cb.and(cb.or(cb.isNotNull(prep), cb.isNotNull(cook)), cb.le(total, minutes));
		};
	}

	/** Case- and accent-insensitive: "creme" finds "Crème brûlée". */
	private static Specification<Recipe> titleContains(String text) {
		// A plain value is sent as a bound parameter; cb.literal() would be inlined into the SQL.
		String pattern = containsPattern(text);
		return (recipe, query, cb) -> cb.like(folded(cb, recipe.get("title")), pattern, LIKE_ESCAPE);
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
