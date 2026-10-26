package fr.lescreationsdeyona.theme;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A look saved under a name in the back-office: applied in one click, then saved as the site's. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class AppearancePreset {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Unique, case and accents ignored. */
	private String name;

	@Enumerated(EnumType.STRING)
	private ThemePreset preset;

	@Enumerated(EnumType.STRING)
	private DisplayFont displayFont;

	@Enumerated(EnumType.STRING)
	private BodyFont bodyFont;

	private int radiusPx;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
