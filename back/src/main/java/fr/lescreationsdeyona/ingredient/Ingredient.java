package fr.lescreationsdeyona.ingredient;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/** Name uniqueness ignores case and accents (database collation {@code case_accent_insensitive}). */
@Entity
@Getter
@Setter
public class Ingredient {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String name;

	/** Null until the admin sets it: "Autres" in the shopping list. */
	@Enumerated(EnumType.STRING)
	private Aisle aisle;

	/** Weight of one piece, for "400 g (≈ 8 œufs)"; null, like the two names, when bought by weight. */
	private BigDecimal pieceGrams;

	private String pieceSingular;

	private String piecePlural;

}
