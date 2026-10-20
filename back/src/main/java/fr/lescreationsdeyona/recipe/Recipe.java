package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.image.Image;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Recipe {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	private String slug;

	private String intro;

	@Enumerated(EnumType.STRING)
	private RecipeStatus status;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	private Category category;

	private Integer servings;

	private Integer prepMinutes;

	private Integer cookMinutes;

	@OneToOne(fetch = FetchType.LAZY)
	private Image image;

	private boolean featured;

	// Collections are modified in place: replacing them would break orphan removal.
	@Setter(AccessLevel.NONE)
	@OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position")
	private List<RecipeIngredient> ingredients = new ArrayList<>();

	@Setter(AccessLevel.NONE)
	@ElementCollection
	@CollectionTable(name = "recipe_step")
	@OrderColumn(name = "position")
	private List<RecipeStep> steps = new ArrayList<>();

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	// Only bumped when the recipe row itself changes: the save use case must also touch it when
	// only ingredients or steps change.
	@LastModifiedDate
	private Instant updatedAt;

	@CreatedBy
	@Column(updatable = false)
	private String createdBy;

	@LastModifiedBy
	private String updatedBy;

}
