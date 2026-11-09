package fr.lescreationsdeyona.shop;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** The single row of the shop's settings; closed until the admin opens it. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class ShopSettings {

	static final int ID = 1;

	@Id
	private Integer id;

	private boolean ordersOpen;

	private String intro;

	/** Where and when to fetch an order, shown in the shop; null for nothing. */
	private String pickupInfo;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
