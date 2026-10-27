package fr.lescreationsdeyona.menu;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuRepository extends JpaRepository<Menu, Long> {

	boolean existsBySlug(String slug);

	/** Case and accents ignored (column collation). */
	Optional<Menu> findByTitle(String title);

	Optional<Menu> findBySlugAndPublishedTrue(String slug);

	List<Menu> findByPublishedTrueOrderByUpdatedAtDesc();

	List<Menu> findAllByOrderByUpdatedAtDesc();

}
