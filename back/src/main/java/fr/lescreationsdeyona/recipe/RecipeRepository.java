package fr.lescreationsdeyona.recipe;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RecipeRepository extends JpaRepository<Recipe, Long>, JpaSpecificationExecutor<Recipe> {

	Optional<Recipe> findBySlugAndStatus(String slug, RecipeStatus status);

	Optional<Recipe> findFirstByFeaturedTrueAndStatus(RecipeStatus status);

	Optional<Recipe> findFirstByFeaturedTrueAndStatusAndTheme(RecipeStatus status, RecipeTheme theme);

	Optional<Recipe> findFirstByStatusOrderByPublishedAtDesc(RecipeStatus status);

	Optional<Recipe> findFirstByStatusAndThemeOrderByPublishedAtDesc(RecipeStatus status, RecipeTheme theme);

	boolean existsBySlug(String slug);

	Optional<Recipe> findBySlug(String slug);

	boolean existsByCategoriesId(long categoryId);

	/**
	 * Unfeatures the published recipes of this theme but {@code keptId} (all of them when null); the
	 * scheduled ones featured ahead are left alone.
	 */
	@Modifying(flushAutomatically = true)
	@Query("""
			update Recipe r set r.featured = false
			where r.featured = true and r.status = RecipeStatus.PUBLISHED and r.theme = :theme
				and (:keptId is null or r.id <> :keptId)""")
	void unfeatureAllExcept(RecipeTheme theme, @Nullable Long keptId);

	@Query("select r.id from Recipe r where r.status = RecipeStatus.DRAFT and r.scheduledAt <= :now order by r.scheduledAt")
	List<Long> findScheduledBefore(Instant now);

	/**
	 * Published recipes closest to {@code id}: a shared tag counts twice, a shared category once,
	 * the same main category once more; the latest first among equals, so that a recipe sharing
	 * nothing still gets suggestions.
	 */
	@Query(value = """
			select r.id from recipe r
			where r.status = 'PUBLISHED' and r.id <> :id
			order by
				2 * (select count(*) from recipe_tag t where t.recipe_id = r.id
					and t.tag_id in (select tag_id from recipe_tag where recipe_id = :id))
				+ (select count(*) from recipe_category c where c.recipe_id = r.id
					and c.category_id in (select category_id from recipe_category where recipe_id = :id))
				+ (select count(*) from recipe_category c where c.recipe_id = r.id and c.position = 0
					and c.category_id = (select category_id from recipe_category where recipe_id = :id and position = 0))
				desc,
				r.published_at desc
			limit :limit""", nativeQuery = true)
	List<Long> findRelatedIds(long id, int limit);

	/** Written without the auditing of the entity, which would date the restored recipe of today. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = "update recipe set created_at = :createdAt, published_at = :publishedAt, view_count = :viewCount where id = :id",
			nativeQuery = true)
	void restoreDates(long id, Instant createdAt, @Nullable Instant publishedAt, long viewCount);

	/** One more visit of a published recipe; updated_at is left alone. */
	@Modifying
	@Query(value = "update recipe set view_count = view_count + 1 where slug = :slug and status = 'PUBLISHED'",
			nativeQuery = true)
	int incrementViewCount(String slug);

}
