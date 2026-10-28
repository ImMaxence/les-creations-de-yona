package fr.lescreationsdeyona.tag;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TagRepository extends JpaRepository<Tag, Long> {

	boolean existsBySlug(String slug);

	Optional<Tag> findBySlug(String slug);

	/** Compared with the column collation: case and accents ignored. */
	boolean existsByName(String name);

	@Query("""
			select new fr.lescreationsdeyona.tag.TrashedTag$RecipeRef(r.id, r.slug)
			from Recipe r join r.tags t where t.id = :tagId""")
	List<TrashedTag.RecipeRef> findRecipesCarrying(long tagId);

	/** Given back to the recipes found by id or URL, those with fewer than 20 tags. */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			insert into recipe_tag (recipe_id, tag_id)
			select r.id, :tagId from recipe r
			where (r.id in (:recipeIds) or r.slug in (:recipeSlugs))
			and (select count(*) from recipe_tag other where other.recipe_id = r.id) < 20
			on conflict do nothing""", nativeQuery = true)
	int addToRecipes(long tagId, Collection<Long> recipeIds, Collection<String> recipeSlugs);

}
