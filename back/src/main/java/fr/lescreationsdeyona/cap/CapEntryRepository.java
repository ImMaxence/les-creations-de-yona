package fr.lescreationsdeyona.cap;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface CapEntryRepository extends JpaRepository<CapEntry, Long> {

	/** The latest first. */
	List<CapEntry> findByStatusOrderByHappenedOnDescIdDesc(CapStatus status);

	List<CapEntry> findAllByOrderByHappenedOnDescIdDesc();

	Optional<CapEntry> findBySlugAndStatus(String slug, CapStatus status);

	Optional<CapEntry> findFirstByStatusAndFeaturedTrue(CapStatus status);

	Optional<CapEntry> findFirstByStatusOrderByHappenedOnDescIdDesc(CapStatus status);

	boolean existsByStatus(CapStatus status);

	boolean existsBySlug(String slug);

	/** Drafts whose scheduled time has come, the earliest first. */
	@Query("select e.id from CapEntry e where e.status = CapStatus.DRAFT and e.scheduledAt <= :now order by e.scheduledAt")
	List<Long> findScheduledBefore(Instant now);

	/** Before another one is put forward: one at most (unique index). */
	@Modifying(flushAutomatically = true)
	@Query("update CapEntry e set e.featured = false where e.featured = true and e.id <> :keptId")
	int unfeatureAllExcept(long keptId);

}
