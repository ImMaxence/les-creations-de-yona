package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.tag.Tag;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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

	@Enumerated(EnumType.STRING)
	private RecipeTheme theme;

	/** Why its scheduled publication did not happen, shown in the back-office; set for a failed recipe only. */
	private String publicationFailure;

	private Integer servings;

	private Integer prepMinutes;

	private Integer cookMinutes;

	/** Resting, rising…: counted in the total time with preparation and cooking. */
	private Integer restMinutes;

	/** 1 to 5, by half points. */
	private BigDecimal difficulty;

	private String youtubeVideoId;

	/** "Le conseil de Yona", in Markdown. */
	private String tip;

	/** Moule à tarte, fouet…: one item per line, in order; null for none. */
	private String equipment;

	/** Mold the quantities are written for: visitors can adapt them to theirs. */
	@Enumerated(EnumType.STRING)
	private MoldShape moldShape;

	/** Diameter (round), side (square) or length (rectangle). */
	private BigDecimal moldLengthCm;

	/** Rectangle only. */
	private BigDecimal moldWidthCm;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	/** Vertical photo offered to Pinterest; without it, the main photo is. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image pinterestImage;

	/**
	 * One published recipe per theme at most. A scheduled draft may be featured ahead: it replaces the
	 * featured recipe of its theme once published.
	 */
	private boolean featured;

	/** First publication, kept if the recipe goes back to draft; null for a recipe never published. */
	private Instant publishedAt;

	/** A draft published by the backend at that time (see ScheduledPublication); kept on a failed one. */
	private Instant scheduledAt;

	/**
	 * Visits of its page, counted by the database alone (RecipeRepository.incrementViewCount):
	 * never written by the entity, so that saving a recipe cannot overwrite views counted meanwhile.
	 */
	@Setter(AccessLevel.NONE)
	@Column(insertable = false, updatable = false)
	private long viewCount;

	// Collections are modified in place: replacing them would break orphan removal.

	/** At least one; the first one is the main category, in the URL of the recipe. */
	@Setter(AccessLevel.NONE)
	@ManyToMany
	@JoinTable(name = "recipe_category", joinColumns = @JoinColumn(name = "recipe_id"),
			inverseJoinColumns = @JoinColumn(name = "category_id"))
	@OrderColumn(name = "position")
	private List<Category> categories = new ArrayList<>();

	/** Any number, none required; sorted by name when shown. */
	@Setter(AccessLevel.NONE)
	@ManyToMany
	@JoinTable(name = "recipe_tag", joinColumns = @JoinColumn(name = "recipe_id"),
			inverseJoinColumns = @JoinColumn(name = "tag_id"))
	@OrderBy("name")
	private Set<Tag> tags = new LinkedHashSet<>();

	/** At least one: a recipe without parts has a single, untitled one. */
	@Setter(AccessLevel.NONE)
	@OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position")
	private List<RecipePart> parts = new ArrayList<>();

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@CreatedBy
	@Column(updatable = false)
	private String createdBy;

	@LastModifiedBy
	private String updatedBy;

	/** In the URL of the recipe: /recettes/{main category slug}/{recipe slug}. */
	public Category getMainCategory() {
		return categories.getFirst();
	}

}
