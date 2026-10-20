package fr.lescreationsdeyona.ingredient;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

}
