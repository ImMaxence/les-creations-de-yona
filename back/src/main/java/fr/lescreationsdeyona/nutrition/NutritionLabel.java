package fr.lescreationsdeyona.nutrition;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * What the label of a product says for 100 g (whey, a biscuit of a brand…), for an ingredient the Ciqual table
 * does not have; typed by the admin, or taken from Open Food Facts.
 */
public record NutritionLabel(
		@Schema(description = "kcal") @NotNull @DecimalMin("0") @DecimalMax("950") @Digits(integer = 3, fraction = 1) BigDecimal kcal,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal proteins,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal carbohydrates,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal sugars,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal fat,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal saturatedFat,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal fibre,
		@Schema(description = "Grams") @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal salt) {

	public NutritionFacts facts() {
		return new NutritionFacts(kcal.doubleValue(), proteins.doubleValue(), carbohydrates.doubleValue(), sugars.doubleValue(),
				fat.doubleValue(), saturatedFat.doubleValue(), fibre.doubleValue(), salt.doubleValue());
	}

	/** Sugars are carbohydrates, saturated fat is fat: a label saying otherwise was mistyped. Not a property of the JSON. */
	@JsonIgnore
	public boolean isConsistent() {
		return sugars.compareTo(carbohydrates) <= 0 && saturatedFat.compareTo(fat) <= 0;
	}

}
