package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
public class Category {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String name;

	private String slug;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	/**
	 * Sweet or savory, given to the recipes whose main category it is; null for a category holding
	 * both ("Apéritifs"), whose recipes each choose theirs.
	 */
	@Enumerated(EnumType.STRING)
	private RecipeTheme theme;

}
