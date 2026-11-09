package fr.lescreationsdeyona.recipe;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/**
 * A part of a recipe (the dough, the filling…), with its own ingredients and steps. A recipe
 * without parts has a single one, untitled.
 */
@Entity
@Getter
@Setter
public class RecipePart {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	private Recipe recipe;

	private int position;

	/** Null for the single part of a recipe without parts. */
	private String title;

	/** Another recipe taken as this part ("Pâte sablée" in a tart): then no ingredient nor step of its own. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Recipe linkedRecipe;

	/** How many times the linked recipe: 1, or 0.5 for half of it. Null without a linked recipe. */
	private BigDecimal linkedRatio;

	@Setter(AccessLevel.NONE)
	@OneToMany(mappedBy = "part", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position")
	private List<RecipeIngredient> ingredients = new ArrayList<>();

	@Setter(AccessLevel.NONE)
	@ElementCollection
	@CollectionTable(name = "recipe_step", joinColumns = @JoinColumn(name = "part_id"))
	@OrderColumn(name = "position")
	private List<RecipeStep> steps = new ArrayList<>();

}
