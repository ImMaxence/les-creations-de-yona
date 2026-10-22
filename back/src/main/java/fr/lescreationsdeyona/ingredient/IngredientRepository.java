package fr.lescreationsdeyona.ingredient;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Comparisons on {@code name} ignore case and accents through the column collation:
 * {@code findByName("creme")} finds "Crème".
 */
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

	Optional<Ingredient> findByName(String name);

	boolean existsByName(String name);

	List<Ingredient> findByNameContainingOrderByNameAsc(String fragment);

	@Query("select count(line) from RecipeIngredient line where line.ingredient.id = :id")
	long countRecipesUsing(long id);

	/** Ingredients used by no recipe are absent. A recipe lists an ingredient once at most. */
	@Query("""
			select new fr.lescreationsdeyona.ingredient.RecipeCount(line.ingredient.id, count(line))
			from RecipeIngredient line group by line.ingredient.id""")
	List<RecipeCount> countRecipesPerIngredient();

}
