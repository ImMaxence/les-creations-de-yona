package fr.lescreationsdeyona.image;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Metadata of an image stored in S3 as {@code {s3Prefix}800.webp} and {@code {s3Prefix}1600.webp}.
 * Immutable: a new photo is a new image, so its URL can be cached forever.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Image implements Persistable<UUID> {

	@Id
	private UUID id;

	@Enumerated(EnumType.STRING)
	private ImageKind kind;

	private String s3Prefix;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

	// The id is set before saving (it names the S3 folder), so Spring Data cannot tell a new image
	// from its id: without this flag, save() would run a SELECT then merge a copy.
	@Getter(AccessLevel.NONE)
	@Transient
	private boolean persisted;

	static Image create(ImageKind kind) {
		Image image = new Image();
		image.id = UUID.randomUUID();
		image.kind = kind;
		image.s3Prefix = kind.folder() + "/" + image.id + "/";
		return image;
	}

	/** S3 key of the variant of the given width. */
	String key(int width) {
		return s3Prefix + width + ".webp";
	}

	@Override
	public boolean isNew() {
		return !persisted;
	}

	@PostLoad
	@PostPersist
	void markPersisted() {
		persisted = true;
	}

}
