package fr.lescreationsdeyona.accounting;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;

/**
 * What a purchase was made of: "Beurre doux, 1 kg, 9,80 €". {@code ingredientId}: the ingredient of the
 * site it is, null for packaging or once the ingredient is gone; {@code item} keeps its name.
 */
@Embeddable
public record PurchaseLine(String item, Long ingredientId, BigDecimal quantity, @Enumerated(EnumType.STRING) PurchaseUnit unit,
		BigDecimal price) {
}
