package fr.lescreationsdeyona.shop;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

	@Enumerated(EnumType.STRING)
	private ShopMode mode;

	/** Where and when to fetch an order, shown in the shop; null for nothing. */
	private String pickupInfo;

	// Who the invoices are from (null until filled in), copied into each invoice when it is issued

	private String sellerName;

	private String sellerAddress;

	/** 14 digits, once the business is registered. */
	private String sellerSiret;

	private String sellerContact;

	/** "TVA non applicable, art. 293 B du CGI" by default. */
	private String vatMention;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
