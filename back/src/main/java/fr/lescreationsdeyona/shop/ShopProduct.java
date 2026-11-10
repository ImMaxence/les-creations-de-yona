package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Something offered in the shop: usually made from a recipe of the blog ("Boîte de 6 cookies"), sold by
 * the unit or by batches, at a price including taxes.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class ShopProduct {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Its recipe, for its categories and its cost price; null for a product without recipe. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Recipe recipe;

	/** "Boîte de 6 cookies": its recipe's title at first. */
	private String name;

	/** Its own photo; null shows its recipe's. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	/** The category of a product without recipe; one with a recipe has the recipe's. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Category category;

	/** Including taxes, for the format as bought: the whole batch. */
	private BigDecimal price;

	/** "le gâteau, 8 parts"; null for nothing. */
	private String portionLabel;

	/** Sold by batches of that many ("Boîte de 6"); null by the unit. */
	private Integer batchSize;

	/** The share of its recipe one product takes, for its cost price: 1 for the whole recipe, 0.5 for half. */
	private BigDecimal recipeShare;

	/** "Boîte kraft", as written in the purchases, for its cost price; null for none. */
	private String packaging;

	private int packagingCount;

	/** Shown in the shop; taken out for a while without losing its price. */
	private boolean available;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

	/** Its own photo, or its recipe's. */
	public @Nullable Image shownImage() {
		return image != null ? image : recipe == null ? null : recipe.getImage();
	}

	/** Its recipe's categories, the main one first, or its own; empty for none. */
	public List<Category> categories() {
		if (recipe != null) {
			return List.copyOf(recipe.getCategories());
		}
		return category == null ? List.of() : List.of(category);
	}

	/** "Boîte de 6", or "À l'unité". */
	public String format() {
		return batchSize == null ? "À l'unité" : "Boîte de " + batchSize;
	}

	/** What an order keeps of its format: "Boîte de 6", "le gâteau, 8 parts" or "À l'unité". */
	public String formatLabel() {
		return batchSize == null && portionLabel != null ? portionLabel : format();
	}

	/** The price of one piece of a batch, rounded to the cent; null by the unit. */
	public @Nullable BigDecimal unitPrice() {
		return batchSize == null ? null : price.divide(BigDecimal.valueOf(batchSize), 2, RoundingMode.HALF_UP);
	}

	/** On sale: available, and its recipe published if it has one. */
	public boolean onSale() {
		return available && (recipe == null || recipe.getStatus() == RecipeStatus.PUBLISHED);
	}

}
