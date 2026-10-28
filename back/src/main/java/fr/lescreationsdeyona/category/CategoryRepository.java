package fr.lescreationsdeyona.category;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryRepository extends JpaRepository<Category, Long> {

	boolean existsBySlug(String slug);

	Optional<Category> findBySlug(String slug);

	/** A photo shows one category at most (unique column). */
	boolean existsByImageId(UUID imageId);

	/** Those holding at least one published recipe. */
	@Query("""
			select distinct c.slug from Recipe r join r.categories c
			where r.status = fr.lescreationsdeyona.recipe.RecipeStatus.PUBLISHED""")
	List<String> findSlugsWithPublishedRecipes();

}
