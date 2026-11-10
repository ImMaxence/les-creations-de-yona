package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.image.Image;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** An article of "Mon CAP": a dated step of the diploma, with its own page made of blocks. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class CapEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	/** Under the title; null for none. */
	private String subtitle;

	/** Its page: /mon-cap/{slug}. Follows the title while the article is a draft, then stays. */
	private String slug;

	private LocalDate happenedOn;

	/** The main photo, at the top of the article and in the timeline. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	@Enumerated(EnumType.STRING)
	private CapStyle style;

	/** The blocks, in order, as a JSON array of {@link CapBlock}: written and read by {@link CapBlocks}. */
	private String blocks;

	private boolean published;

	/** "Mettre en avant": on the home page in place of the latest article, one at most. */
	private boolean featured;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
