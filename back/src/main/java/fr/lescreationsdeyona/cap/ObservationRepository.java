package fr.lescreationsdeyona.cap;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ObservationRepository extends JpaRepository<Observation, Long> {

	Page<Observation> findByPublishedTrueOrderByObservedOnDescIdDesc(Pageable pageable);

	Page<Observation> findAllByOrderByObservedOnDescIdDesc(Pageable pageable);

	/** About a published recipe: a draft has no page to show them on. */
	@Query("""
			select o from Observation o
			where o.published = true and o.recipe.slug = :slug
				and o.recipe.status = fr.lescreationsdeyona.recipe.RecipeStatus.PUBLISHED
			order by o.observedOn desc, o.id desc""")
	List<Observation> findPublishedOfRecipe(String slug);

	@Query("select o.id from Observation o where o.recipe.id = :recipeId")
	List<Long> findIdsByRecipeId(long recipeId);

	/** Those about a recipe put back from the trash; "Pas de recette" meanwhile, unless linked to another since. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = "update observation set recipe_id = :recipeId where id in (:ids) and recipe_id is null", nativeQuery = true)
	int linkToRecipe(long recipeId, Collection<Long> ids);

}
