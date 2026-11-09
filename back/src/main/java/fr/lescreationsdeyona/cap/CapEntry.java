package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.image.Image;
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

/** A dated step of "Mon CAP": the timeline of the diploma, in the blog. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class CapEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	/** Markdown; null for a step with a title only. */
	private String body;

	private LocalDate happenedOn;

	@ManyToOne(fetch = FetchType.LAZY)
	private Image image;

	private boolean published;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
