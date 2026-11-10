package fr.lescreationsdeyona.shop;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

	Optional<Invoice> findByOrderId(long orderId);

	List<Invoice> findByOrderIdIn(Collection<Long> orderIds);

	boolean existsByOrderId(long orderId);

	/** From {@code from} to {@code to} included, the latest first. */
	List<Invoice> findByIssuedOnBetweenOrderByIssuedOnDescIdDesc(LocalDate from, LocalDate to);

	/** The highest rank given in a year ("2026-0012" → 12); 0 before the first one. */
	@Query(value = """
			select coalesce(max(cast(split_part(number, '-', 2) as integer)), 0) from invoice where number like :year || '-%'""",
			nativeQuery = true)
	int findLastRank(String year);

}
