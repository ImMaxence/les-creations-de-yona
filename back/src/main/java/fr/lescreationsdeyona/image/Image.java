package fr.lescreationsdeyona.image;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Metadata of an image stored in S3 as {@code {s3Prefix}800.webp} and {@code {s3Prefix}1600.webp}. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Image {

	@Id
	private UUID id;

	@Enumerated(EnumType.STRING)
	private ImageKind kind;

	private String s3Prefix;

	@CreatedDate
	@Column(updatable = false)
	private Instant createdAt;

}
