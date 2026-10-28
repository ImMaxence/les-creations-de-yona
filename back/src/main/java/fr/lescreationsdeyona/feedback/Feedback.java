package fr.lescreationsdeyona.feedback;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

/** A message sent by a visitor ("Donner mon avis"). */
@Entity
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Feedback {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Instant createdAt;

	private String message;

	/** Given by the visitor who wants an answer. */
	private @Nullable String email;

	/** Where the visitor was ("/recettes/tartes/tarte-fine"). */
	private @Nullable String page;

	/** Read in the back-office. */
	private @Nullable Instant readAt;

	Feedback(Instant createdAt, String message, @Nullable String email, @Nullable String page) {
		this.createdAt = createdAt;
		this.message = message;
		this.email = email;
		this.page = page;
	}

}
