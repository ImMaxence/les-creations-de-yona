package fr.lescreationsdeyona.image;

import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ImageRepository extends JpaRepository<Image, UUID> {

	/** Every image with the recipe or category using it, so the back-office can warn before deleting it. */
	@Query(value = """
			select new fr.lescreationsdeyona.image.GalleryImage(i.id, i.kind, i.createdAt, coalesce(r.title, c.name))
			from Image i
			left join Recipe r on r.image = i
			left join Category c on c.image = i
			where :kind is null or i.kind = :kind""",
			countQuery = "select count(i) from Image i where :kind is null or i.kind = :kind")
	Page<GalleryImage> findGallery(@Nullable ImageKind kind, Pageable pageable);

}
