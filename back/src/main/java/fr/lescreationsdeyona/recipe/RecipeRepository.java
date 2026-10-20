package fr.lescreationsdeyona.recipe;

import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RecipeRepository extends JpaRepository<Recipe, Long>, JpaSpecificationExecutor<Recipe> {

	Optional<Recipe> findBySlugAndStatus(String slug, RecipeStatus status);

	Optional<Recipe> findFirstByFeaturedTrue();

	Optional<Recipe> findFirstByStatusOrderByCreatedAtDesc(RecipeStatus status);

	boolean existsBySlug(String slug);

	boolean existsByCategoryId(long categoryId);

	/** Unfeatures every recipe but {@code keptId} (all of them when null). */
	@Modifying(flushAutomatically = true)
	@Query("update Recipe r set r.featured = false where r.featured = true and (:keptId is null or r.id <> :keptId)")
	void unfeatureAllExcept(@Nullable Long keptId);

}
