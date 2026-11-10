package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.image.Image;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
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

	/** Always positive: {@link #kind} says which way it goes. With purchases, their total. */
	private BigDecimal amount;

	private String adminEmail;

	/** The order it comes from: its amount then follows the order. Null for a line typed by hand. */
	private Long orderId;

	/** The photo of the receipt of an expense; null for none. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image receiptImage;

	/** What an expense for ingredients or packaging was made of; empty when not detailed. */
	@Setter(AccessLevel.NONE)
	@ElementCollection
	@CollectionTable(name = "account_purchase_line", joinColumns = @JoinColumn(name = "entry_id"))
	@OrderColumn(name = "position")
	private List<PurchaseLine> purchases = new ArrayList<>();

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
