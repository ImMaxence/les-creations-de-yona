package fr.lescreationsdeyona.accounting;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AccountEntryRepository extends JpaRepository<AccountEntry, Long> {

	Optional<AccountEntry> findByOrderId(long orderId);

	/** From {@code from} to {@code to} included, the latest first. */
	List<AccountEntry> findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(LocalDate from, LocalDate to);

	/** The years having at least one line, the latest first. */
	@Query(value = "select distinct cast(extract(year from occurred_on) as integer) from account_entry order by 1 desc",
			nativeQuery = true)
	List<Integer> findYears();

	/** A line of a purchase, with its date. */
	record PurchaseRow(String item, Long ingredientId, BigDecimal quantity, PurchaseUnit unit, BigDecimal price,
			LocalDate occurredOn) {
	}

	/** Every line of every purchase, the latest first: the first of each item is its last price paid. */
	@Query("""
			select new fr.lescreationsdeyona.accounting.AccountEntryRepository$PurchaseRow(p.item, p.ingredientId, p.quantity, p.unit,
				p.price, e.occurredOn)
			from AccountEntry e join e.purchases p
			order by e.occurredOn desc, e.id desc""")
	List<PurchaseRow> findPurchasesLatestFirst();

}
