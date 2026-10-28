package fr.lescreationsdeyona.audit;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

/** A line of the back-office history; written once, never changed. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Instant happenedAt;

	/** The admin's email, or {@link AuditLog#SITE} for what the site does on its own. */
	private String actor;

	@Enumerated(EnumType.STRING)
	private AuditAction action;

	@Enumerated(EnumType.STRING)
	private AuditKind kind;

	/** Its title or name at that time. */
	private String label;

	/** To link to it while it exists. */
	private @Nullable Long targetId;

	AuditEvent(Instant happenedAt, String actor, AuditAction action, AuditKind kind, String label, @Nullable Long targetId) {
		this.happenedAt = happenedAt;
		this.actor = actor;
		this.action = action;
		this.kind = kind;
		this.label = label;
		this.targetId = targetId;
	}

}
