package fr.lescreationsdeyona.push;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** What the browser's {@code PushSubscription.toJSON()} gives. */
public record PushSubscriptionForm(
		@Schema(description = "Address of the browser's push service (Google, Mozilla, Apple, Microsoft)")
		@NotBlank @Size(max = 1000) String endpoint,
		@NotNull @Valid Keys keys) {

	/** base64url: the browser's P-256 public key, and its 16-byte authentication secret. */
	public record Keys(@NotBlank @Size(max = 200) String p256dh, @NotBlank @Size(max = 100) String auth) {
	}

}
