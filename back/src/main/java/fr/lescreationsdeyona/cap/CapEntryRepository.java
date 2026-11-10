package fr.lescreationsdeyona.cap;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface CapEntryRepository extends JpaRepository<CapEntry, Long> {

	/** The latest first. */
	List<CapEntry> findByPublishedTrueOrderByHappenedOnDescIdDesc();

	List<CapEntry> findAllByOrderByHappenedOnDescIdDesc();

	Optional<CapEntry> findBySlugAndPublishedTrue(String slug);

	Optional<CapEntry> findFirstByPublishedTrueAndFeaturedTrue();

	Optional<CapEntry> findFirstByPublishedTrueOrderByHappenedOnDescIdDesc();

	boolean existsByPublishedTrue();

	boolean existsBySlug(String slug);

	/** Before another one is put forward: one at most (unique index). */
	@Modifying(flushAutomatically = true)
	@Query("update CapEntry e set e.featured = false where e.featured = true and e.id <> :keptId")
	int unfeatureAllExcept(long keptId);

}
