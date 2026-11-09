package fr.lescreationsdeyona.shop;

import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

/**
 * A line of an order, as it was at that time: the recipe and its price may change or go.
 * {@code recipeId}: without foreign key (see the migration); its order is the position in the order's list.
 */
@Embeddable
public record ShopOrderLine(Long recipeId, String title, String portionLabel, BigDecimal unitPrice, int quantity) {
}
