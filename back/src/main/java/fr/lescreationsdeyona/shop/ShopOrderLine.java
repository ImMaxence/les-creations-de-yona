package fr.lescreationsdeyona.shop;

import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/**
 * A line of an order, as it was at that time: the product, its recipe and its price may change or go.
 * {@code productId}, {@code recipeId}: without foreign key (see the migrations); null for a line from
 * before 2.4 without product, or a product without recipe. {@code title}: the product's name;
 * {@code portionLabel}: its format ("Boîte de 6"). Its order is the position in the order's list.
 */
@Embeddable
public record ShopOrderLine(Long productId, Long recipeId, String title, String portionLabel, BigDecimal unitPrice,
		int quantity) {
}
