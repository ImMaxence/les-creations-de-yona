package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.ingredient.Ingredient;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.ManyToOne;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/** An ingredient line of a recipe part, e.g. "200 g flour (sifted)". */
@Entity
@IdClass(RecipeIngredient.Key.class)
@Getter
@Setter
public class RecipeIngredient {

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	private RecipePart part;

	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	private Ingredient ingredient;

	private BigDecimal quantity;

	private String unit;

	private String note;

	private int position;

	/**
	 * Composite primary key (part_id, ingredient_id): an ingredient appears once per part, but may
	 * appear in several parts of a recipe.
	 */
	public record Key(Long part, Long ingredient) {
	}

}
