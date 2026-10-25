package fr.lescreationsdeyona.ingredient;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Comparisons on {@code name} ignore case and accents through the column collation:
 * {@code findByName("creme")} finds "Crème".
 */
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

	Optional<Ingredient> findByName(String name);

	boolean existsByName(String name);

	List<Ingredient> findByNameContainingOrderByNameAsc(String fragment);

	/** Recipes, not lines: a recipe may list an ingredient in several of its parts. */
	@Query("select count(distinct line.part.recipe.id) from RecipeIngredient line where line.ingredient.id = :id")
	long countRecipesUsing(long id);

	/** Ingredients used by no recipe are absent. */
	@Query("""
			select new fr.lescreationsdeyona.ingredient.RecipeCount(line.ingredient.id, count(distinct line.part.recipe.id))
			from RecipeIngredient line group by line.ingredient.id""")
	List<RecipeCount> countRecipesPerIngredient();

	/** Titles of the recipes having two of these ingredients in the same part, which a merge would collide. */
	@Query(value = """
			select distinct recipe.title from recipe_ingredient line
			join recipe_part part on part.id = line.part_id
			join recipe on recipe.id = part.recipe_id
			where line.ingredient_id in (:ids)
			group by line.part_id, recipe.title
			having count(*) > 1""", nativeQuery = true)
	List<String> findRecipesListingTwiceAny(Collection<Long> ids);

	/**
	 * Lines are moved with SQL: the ingredient is part of their primary key, which JPA cannot
	 * change. Pending changes are written first, and the persistence context cleared after.
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = "update recipe_ingredient set ingredient_id = :targetId where ingredient_id in (:sourceIds)",
			nativeQuery = true)
	void moveLines(long targetId, Collection<Long> sourceIds);

}
