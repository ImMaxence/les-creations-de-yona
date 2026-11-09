package fr.lescreationsdeyona.shop;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, Long> {

	Optional<ShopOrder> findByTrackingToken(UUID trackingToken);

	long countByStatus(OrderStatus status);

	/** The latest first; {@code status} null for all of them. */
	@Query("select o from ShopOrder o where (:status is null or o.status = :status) order by o.createdAt desc, o.id desc")
	Page<ShopOrder> findLatest(@Nullable OrderStatus status, Pageable pageable);

	/** Finished for 12 months: the customers' names and contacts go. Lines go with their order (cascade in the database). */
	@Modifying
	@Query(value = "delete from shop_order where status in ('PICKED_UP', 'CANCELLED') and updated_at < :before", nativeQuery = true)
	int deleteFinishedBefore(Instant before);

}
