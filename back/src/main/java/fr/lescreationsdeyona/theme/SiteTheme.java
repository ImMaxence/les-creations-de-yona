package fr.lescreationsdeyona.theme;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Look of the public site. The table holds a single row, created by the migration. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SiteTheme {

	static final short SINGLE_ROW_ID = 1;

	@Id
	@Setter(AccessLevel.NONE)
	private Short id;

	@Enumerated(EnumType.STRING)
	private ThemePreset preset;

	@Enumerated(EnumType.STRING)
	private DisplayFont displayFont;

	@Enumerated(EnumType.STRING)
	private BodyFont bodyFont;

	/** Corner radius of cards and fields; the other corners are derived from it in the front. */
	private int radiusPx;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}