package fr.lescreationsdeyona.audit;

import java.time.Instant;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

	/** The latest first; {@code kind} null for all. */
	@Query("select e from AuditEvent e where (:kind is null or e.kind = :kind) order by e.happenedAt desc, e.id desc")
	Page<AuditEvent> findLatest(@Nullable AuditKind kind, Pageable pageable);

	@Modifying
	@Query("delete from AuditEvent e where e.happenedAt < :before")
	int deleteHappenedBefore(Instant before);

}
