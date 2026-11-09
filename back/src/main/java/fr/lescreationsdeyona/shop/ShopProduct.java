package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.recipe.Recipe;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A recipe of the blog offered in the shop, with its price. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class ShopProduct {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	private Recipe recipe;

	private BigDecimal price;

	/** "Pour 8 personnes"; null for nothing. */
	private String portionLabel;

	/** Shown in the shop; taken out for a while without losing its price. */
	private boolean available;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
