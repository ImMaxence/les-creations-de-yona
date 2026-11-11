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

	/** Put there by the others (another admin, the site itself) since then, and still there. */
	@Query("select count(t) from TrashItem t where t.deletedAt > :since and t.deletedBy <> :admin")
	long countByOthersSince(Instant since, String admin);

	@Modifying
	@Query("delete from TrashItem t where t.deletedAt < :before")
	int deleteDeletedBefore(Instant before);

}
