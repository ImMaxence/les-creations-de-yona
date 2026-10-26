package fr.lescreationsdeyona.tag;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;

/** Végétarien, sans gluten, de saison…: a recipe has any number of them, none required. */
@Entity
@Getter
@Setter
public class Tag {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Unique, case and accents ignored. */
	private String name;

	private String slug;

}
