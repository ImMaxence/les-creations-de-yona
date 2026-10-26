package fr.lescreationsdeyona.push;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Public: visitors subscribe without any account. No CSRF token (see SecurityConfig). */
@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
class PushController {

	private final PushService pushService;

	/** @param publicKey VAPID public key, base64url: the browser's applicationServerKey */
	record PublicKeyResponse(String publicKey) {
	}

	@Operation(summary = "Public key the browser subscribes with (applicationServerKey)")
	@GetMapping("/public-key")
	PublicKeyResponse getPushPublicKey() {
		return new PublicKeyResponse(pushService.publicKey());
	}

	@Operation(summary = "Notify this browser of new recipes",
			description = "The body of PushSubscription.toJSON(). Only the push services of browsers are accepted.")
	@PostMapping("/subscriptions")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void subscribeToNotifications(@Valid @RequestBody PushSubscriptionForm form) {
		pushService.subscribe(form);
	}

	@Operation(summary = "Stop notifying this browser")
	@DeleteMapping("/subscriptions")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void unsubscribeFromNotifications(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		pushService.unsubscribe(endpoint);
	}

}
