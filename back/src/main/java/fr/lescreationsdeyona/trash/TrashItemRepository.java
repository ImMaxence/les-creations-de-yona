package fr.lescreationsdeyona.trash;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface TrashItemRepository extends JpaRepository<TrashItem, Long> {

	List<TrashItem> findAllByOrderByDeletedAtDesc();

	List<TrashItem> findByKind(TrashKind kind);

	List<TrashItem> findByKindAndDeletedAtBefore(TrashKind kind, Instant before);

	@Modifying
	@Query("delete from TrashItem t where t.deletedAt < :before")
	int deleteDeletedBefore(Instant before);

}
