package fr.lescreationsdeyona.feedback;

import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface FeedbackRepository extends JpaRepository<Feedback, Long> {

	Page<Feedback> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

	long countByReadAtIsNull();

	@Modifying
	@Query("delete from Feedback f where f.createdAt < :before")
	int deleteCreatedBefore(Instant before);

}
