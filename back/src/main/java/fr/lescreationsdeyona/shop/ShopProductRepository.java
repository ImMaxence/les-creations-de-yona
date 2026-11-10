package fr.lescreationsdeyona.shop;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ShopProductRepository extends JpaRepository<ShopProduct, Long> {

	/** On sale: available, its recipe published if it has one. By name. */
	@Query("""
			select p from ShopProduct p left join p.recipe r
			where p.available = true and (r is null or r.status = fr.lescreationsdeyona.recipe.RecipeStatus.PUBLISHED)
			order by p.name""")
	List<ShopProduct> findOnSale();

	@Query("select p from ShopProduct p order by p.name")
	List<ShopProduct> findAllByName();

	/** Titles of those of these recipes that are in the shop, which keeps them from being deleted. */
	@Query("select distinct p.recipe.title from ShopProduct p where p.recipe.id in :recipeIds order by p.recipe.title")
	List<String> findTitlesOfRecipes(Collection<Long> recipeIds);

}
