package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.image.Image;
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
 * A deleted recipe, kept 30 days in the trash: the recipe as the back-office edits it, in JSON
 * ({@link RecipeDetail}). Nothing else in the database refers to it, so no query of the site has
 * to leave deleted recipes out; restoring it creates the recipe again.
 */
@Entity
@Getter
@Setter
public class RecipeTrash {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	/** Its URL when deleted, given back if still free. */
	private String slug;

	@Enumerated(EnumType.STRING)
	private RecipeStatus status;

	/** Kept by the database while the photo stays in the gallery; null once deleted from it. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image pinterestImage;

	/** {@link RecipeDetail} as JSON. */
	@JdbcTypeCode(SqlTypes.JSON)
	private String content;

	private Instant deletedAt;

	private String deletedBy;

}
