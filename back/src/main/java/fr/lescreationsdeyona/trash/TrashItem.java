package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Something deleted in the back-office, kept 30 days in the trash: a recipe, a category, a menu or
 * a photo, in JSON. Nothing else in the database refers to it, so no query of the site has to
 * leave deleted things out; restoring it creates it again.
 */
@Entity
@Getter
@Setter
public class TrashItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	private TrashKind kind;

	private String title;

	/** Its URL when deleted, given back if still free; none for a photo. */
	private String slug;

	/** A recipe's only. */
	@Enumerated(EnumType.STRING)
	private RecipeStatus status;

	/** Shown next to it; kept by the database while the photo stays in the gallery, null once deleted from it. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image pinterestImage;

	/** What was deleted, as JSON: {@code RecipeDetail}, {@code CategoryResponse}, {@code TrashedMenu} or {@code TrashedImage}. */
	@JdbcTypeCode(SqlTypes.JSON)
	private String content;

	/** Where it was shown, to put it back there: {@code RecipeLinks} or {@code ImageLinks}; null for none. */
	@JdbcTypeCode(SqlTypes.JSON)
	private String links;

	/** A recipe's views. */
	private Long viewCount;

	private Instant deletedAt;

	private String deletedBy;

}
