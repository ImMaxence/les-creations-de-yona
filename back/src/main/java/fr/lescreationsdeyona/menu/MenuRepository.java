package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.recipe.RecipeLinks;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface MenuRepository extends JpaRepository<Menu, Long> {

	boolean existsBySlug(String slug);

	/** Case and accents ignored (column collation). */
	Optional<Menu> findByTitle(String title);

	Optional<Menu> findBySlugAndPublishedTrue(String slug);

	List<Menu> findByPublishedTrueOrderByUpdatedAtDesc();

	List<Menu> findAllByOrderByUpdatedAtDesc();

	/** The menus showing a recipe, and its place in each. */
	@Query("""
			select new fr.lescreationsdeyona.recipe.RecipeLinks$MenuPlace(m.id, index(r))
			from Menu m join m.recipes r where r.id = :recipeId order by m.id""")
	List<RecipeLinks.MenuPlace> findPlacesOf(long recipeId);

	/** Written without the auditing of the entity, which would date the restored menu of today. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = "update menu set created_at = :createdAt where id = :id", nativeQuery = true)
	void restoreCreatedAt(long id, Instant createdAt);

}
