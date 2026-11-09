package fr.lescreationsdeyona.shop;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ShopProductRepository extends JpaRepository<ShopProduct, Long> {

	boolean existsByRecipeId(long recipeId);

	/** On sale: available, its recipe published. By title. */
	@Query("""
			select p from ShopProduct p
			where p.available = true and p.recipe.status = fr.lescreationsdeyona.recipe.RecipeStatus.PUBLISHED
			order by p.recipe.title""")
	List<ShopProduct> findOnSale();

	@Query("select p from ShopProduct p order by p.recipe.title")
	List<ShopProduct> findAllByTitle();

	/** Titles of those of these recipes that are in the shop, which keeps them from being deleted. */
	@Query("select p.recipe.title from ShopProduct p where p.recipe.id in :recipeIds order by p.recipe.title")
	List<String> findTitlesOfRecipes(Collection<Long> recipeIds);

}
