package fr.lescreationsdeyona.content;

import fr.lescreationsdeyona.image.Image;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Texts and photo of the public site edited in the back-office. The site's name and icon are not
 * here: they stay in the code, for search engines and the installed app. A single row, created by
 * the migration.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SiteContent {

	public static final short SINGLE_ROW_ID = 1;

	@Id
	@Setter(AccessLevel.NONE)
	private Short id;

	private String aboutTitle;

	/** Plain text; a blank line starts a new paragraph. */
	private String aboutText;

	/** Null: the home page shows the photo bundled with the front. */
	@ManyToOne(fetch = FetchType.LAZY)
	private Image aboutImage;

	private String footerText;

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
