package fr.lescreationsdeyona.accounting;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A line of the accounts, counted for an admin. Holds nothing about the customers: it outlives the orders. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class AccountEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	private AccountKind kind;

	@Enumerated(EnumType.STRING)
	private AccountCategory category;

	private LocalDate occurredOn;

	private String label;

	/** Always positive: {@link #kind} says which way it goes. */
	private BigDecimal amount;

	private String adminEmail;

	/** The order it comes from: its amount then follows the order. Null for a line typed by hand. */
	private Long orderId;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
