package fr.lescreationsdeyona.category;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {

	boolean existsBySlug(String slug);

	Optional<Category> findBySlug(String slug);

	/** A photo shows one category at most (unique column). */
	boolean existsByImageId(UUID imageId);

}
