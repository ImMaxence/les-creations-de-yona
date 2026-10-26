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

	/**
	 * Images of the gallery, optionally only those shown (or not shown) by a recipe (as its photo
	 * or its Pinterest photo), a category or the "À propos" section. {@code portrait}: true for the
	 * vertical Pinterest photos only, false for all the others (landscape), null for all.
	 */
	@Query("""
			select i from Image i
			where (:kind is null or i.kind = :kind)
			and (:portrait is null
				or (:portrait = true and i.kind = fr.lescreationsdeyona.image.ImageKind.PINTEREST)
				or (:portrait = false and i.kind <> fr.lescreationsdeyona.image.ImageKind.PINTEREST))
			and (:used is null
				or (:used = true and (exists (select 1 from Recipe r where r.image = i or r.pinterestImage = i)
					or exists (select 1 from Category c where c.image = i)
					or exists (select 1 from SiteContent s where s.aboutImage = i)))
				or (:used = false and not exists (select 1 from Recipe r where r.image = i or r.pinterestImage = i)
					and not exists (select 1 from Category c where c.image = i)
					and not exists (select 1 from SiteContent s where s.aboutImage = i)))""")
	Page<Image> findGallery(@Nullable ImageKind kind, @Nullable Boolean portrait, @Nullable Boolean used,
			Pageable pageable);

	@Query("""
			select new fr.lescreationsdeyona.image.GalleryImage$RecipeUsage(r.image.id, r.id, r.title)
			from Recipe r where r.image.id in :imageIds order by r.title""")
	List<GalleryImage.RecipeUsage> findRecipeUsages(Collection<UUID> imageIds);

	@Query("""
			select new fr.lescreationsdeyona.image.GalleryImage$RecipeUsage(r.pinterestImage.id, r.id, r.title)
			from Recipe r where r.pinterestImage.id in :imageIds order by r.title""")
	List<GalleryImage.RecipeUsage> findPinterestUsages(Collection<UUID> imageIds);

	@Query("""
			select new fr.lescreationsdeyona.image.GalleryImage$CategoryUsage(c.image.id, c.id, c.name, c.slug)
			from Category c where c.image.id in :imageIds order by c.name""")
	List<GalleryImage.CategoryUsage> findCategoryUsages(Collection<UUID> imageIds);

}
