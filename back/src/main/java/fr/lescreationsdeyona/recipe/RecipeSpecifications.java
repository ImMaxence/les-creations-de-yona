package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.Texts;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/** Recipe search criteria. User input is always a bound parameter, never concatenated into SQL. */
final class RecipeSpecifications {

	private static final char LIKE_ESCAPE = '\\';

	private RecipeSpecifications() {
	}

	/**
	 * @param ingredientQuery part of the name of one of its ingredients, in any part
	 * @param ingredientId one of its ingredients exactly (back-office link from the ingredients page)
	 */
	static Specification<Recipe> matching(@Nullable String titleQuery, @Nullable String categorySlug,
			@Nullable String ingredientQuery, @Nullable Long ingredientId, @Nullable RecipeStatus status) {
		List<Specification<Recipe>> criteria = new ArrayList<>();
		if (status != null) {
			criteria.add((recipe, query, cb) -> cb.equal(recipe.get("status"), status));
		}
		if (StringUtils.hasText(categorySlug)) {
			// One row per recipe: a recipe is in a category once at most.
			criteria.add((recipe, query, cb) -> cb.equal(recipe.join("categories").get("slug"), categorySlug));
		}
		if (StringUtils.hasText(titleQuery)) {
			criteria.add(titleContains(titleQuery.strip()));
		}
		if (StringUtils.hasText(ingredientQuery)) {
			String pattern = containsPattern(ingredientQuery.strip());
			criteria.add(hasIngredient((line, cb) -> cb.like(folded(cb, line.get("ingredient").get("name")), pattern,
					LIKE_ESCAPE)));
		}
		if (ingredientId != null) {
			criteria.add(hasIngredient((line, cb) -> cb.equal(line.get("ingredient").get("id"), ingredientId)));
		}
		return Specification.allOf(criteria);
	}

	/** Case- and accent-insensitive: "creme" finds "Crème brûlée". */
	private static Specification<Recipe> titleContains(String text) {
		// A plain value is sent as a bound parameter; cb.literal() would be inlined into the SQL.
		String pattern = containsPattern(text);
		return (recipe, query, cb) -> cb.like(folded(cb, recipe.get("title")), pattern, LIKE_ESCAPE);
	}

	/**
	 * A subquery rather than a join: a recipe listing the ingredient in several parts, or several
	 * matching ingredients, still comes out once.
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
