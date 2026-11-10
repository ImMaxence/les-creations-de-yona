package fr.lescreationsdeyona.shop;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ShopSettingsRepository extends JpaRepository<ShopSettings, Integer> {

	/** Locked until the end of the transaction: invoices take their numbers one after the other. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from ShopSettings s where s.id = :id")
	Optional<ShopSettings> findForUpdate(int id);

}
