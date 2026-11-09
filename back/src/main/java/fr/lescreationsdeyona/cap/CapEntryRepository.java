package fr.lescreationsdeyona.cap;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapEntryRepository extends JpaRepository<CapEntry, Long> {

	/** The latest first. */
	List<CapEntry> findByPublishedTrueOrderByHappenedOnDescIdDesc();

	List<CapEntry> findAllByOrderByHappenedOnDescIdDesc();

	boolean existsByPublishedTrue();

}
