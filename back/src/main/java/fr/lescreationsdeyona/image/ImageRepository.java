package fr.lescreationsdeyona.image;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ImageRepository extends JpaRepository<Image, UUID> {

	/** Images of the gallery, optionally only those shown (or not shown) by a recipe or a category. */
	@Query("""
			select i from Image i
			where (:kind is null or i.kind = :kind)
			and (:used is null
				or (:used = true and (exists (select 1 from Recipe r where r.image = i)
					or exists (select 1 from Category c where c.image = i)))
				or (:used = false and not exists (select 1 from Recipe r where r.image = i)
					and not exists (select 1 from Category c where c.image = i)))""")
	Page<Image> findGallery(@Nullable ImageKind kind, @Nullable Boolean used, Pageable pageable);

	@Query("""
			select new fr.lescreationsdeyona.image.GalleryImage$RecipeUsage(r.image.id, r.id, r.title)
			from Recipe r where r.image.id in :imageIds order by r.title""")
	List<GalleryImage.RecipeUsage> findRecipeUsages(Collection<UUID> imageIds);

	@Query("""
			select new fr.lescreationsdeyona.image.GalleryImage$CategoryUsage(c.image.id, c.id, c.name, c.slug)
			from Category c where c.image.id in :imageIds order by c.name""")
	List<GalleryImage.CategoryUsage> findCategoryUsages(Collection<UUID> imageIds);

}
