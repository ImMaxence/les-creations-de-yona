package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.Recipe;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * "Menu de Noël", "Goûter d'anniversaire": a few recipes put together by the admin, on a page of
 * their own. Its photo is the one chosen for it, or else the one of its first recipe.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Menu {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Unique, case and accents ignored. */
	private String title;

	/** Generated at creation, never changed after: the address of its page stays. */
	private String slug;

	private String intro;

	/** Shown on the site; its draft recipes are not, even then. */
	private boolean published;

	/** Chosen for it; without one, the photo of its first recipe that has one. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	/** In order; modified in place, as the recipes' categories. */
	@Setter(AccessLevel.NONE)
	@ManyToMany
	@JoinTable(name = "menu_recipe", joinColumns = @JoinColumn(name = "menu_id"),
			inverseJoinColumns = @JoinColumn(name = "recipe_id"))
	@OrderColumn(name = "position")
	private List<Recipe> recipes = new ArrayList<>();

	@CreatedDate
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
