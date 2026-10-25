package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.Texts;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/** Recipe search criteria. User input is always a bound parameter, never concatenated into SQL. */
final class RecipeSpecifications {

	private static final char LIKE_ESCAPE = '\\';

	private RecipeSpecifications() {
	}

	static Specification<Recipe> matching(@Nullable String titleQuery, @Nullable String categorySlug,
			@Nullable RecipeStatus status) {
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
		return Specification.allOf(criteria);
	}

	/** Case- and accent-insensitive: "creme" finds "Crème brûlée". */
	private static Specification<Recipe> titleContains(String text) {
		// A plain value is sent as a bound parameter; cb.literal() would be inlined into the SQL.
		String pattern = "%" + escapeLikeWildcards(Texts.foldCaseAndAccents(text)) + "%";
		return (recipe, query, cb) -> cb.like(
				cb.function("unaccent", String.class, cb.lower(recipe.get("title"))), pattern, LIKE_ESCAPE);
	}

	/** "100%" searches for a literal "100%", not for "100" followed by anything. */
	private static String escapeLikeWildcards(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
