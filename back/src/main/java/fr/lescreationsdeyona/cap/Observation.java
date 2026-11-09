package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.Recipe;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** "Mes observations": what was noticed while cooking, about a recipe or about none ("Pas de recette"). */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Observation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	/** Markdown. */
	private String body;

	private LocalDate observedOn;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	/** Null for "Pas de recette". Many observations may be about the same recipe. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Recipe recipe;

	private boolean published;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
