package fr.lescreationsdeyona.shop;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/** An order sent from the shop. No payment on the site: the admin agrees on the rest with the customer. */
@Entity
@Getter
@Setter
public class ShopOrder {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** The secret of the customer's link: follows the order without any account. */
	private UUID trackingToken;

	@Enumerated(EnumType.STRING)
	private OrderStatus status;

	private String customerName;

	private String customerEmail;

	private String customerPhone;

	private LocalDate wantedOn;

	/** The customer's free text. */
	private String message;

	/** Seen by the admins only. */
	private String adminNote;

	/** The total of the lines at first; the admin may change it (a discount, an extra asked in the message). */
	private BigDecimal amount;

	/** Email of the admin in charge: the money is counted for them in the accounts. */
	private String handledBy;

	private Instant createdAt;

	private Instant updatedAt;

	@Setter(AccessLevel.NONE)
	@ElementCollection
	@CollectionTable(name = "shop_order_line", joinColumns = @JoinColumn(name = "order_id"))
	@OrderColumn(name = "position")
	private List<ShopOrderLine> lines = new ArrayList<>();

}
