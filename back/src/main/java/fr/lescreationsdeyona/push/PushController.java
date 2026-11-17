package fr.lescreationsdeyona.push;

import fr.lescreationsdeyona.common.ClientAddress;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
			description = "The body of PushSubscription.toJSON(). Only the push services of browsers are accepted. "
					+ "New subscriptions: 10 an hour from an address, 300 an hour for the whole site.")
	@PostMapping("/subscriptions")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void subscribeToNotifications(@Valid @RequestBody PushSubscriptionForm form, HttpServletRequest request) {
		pushService.subscribe(form, ClientAddress.of(request));
	}

	@Operation(summary = "What this browser is told of", description = "Nothing for a browser the site does not know.")
	@GetMapping("/subscriptions")
	NotificationTopics getNotificationTopics(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		return pushService.topics(endpoint);
	}

	/** "Mes notifications": the subscription of the browser, and what it is told of. */
	record NotificationTopicsForm(@NotNull @Valid PushSubscriptionForm subscription, boolean recipes, boolean articles) {
	}

	@Operation(summary = "Choose what this browser is told of",
			description = "In place of what it was told of; nothing at all unsubscribes it. Same limits as a new subscription.")
	@PutMapping("/subscriptions")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void chooseNotificationTopics(@Valid @RequestBody NotificationTopicsForm form, HttpServletRequest request) {
		pushService.choose(form.subscription(), new NotificationTopics(form.recipes(), form.articles()), ClientAddress.of(request));
	}

	/** @param kept the device is still told of an admin's alerts: its browser keeps its subscription */
	record Unsubscribed(boolean kept) {
	}

	@Operation(summary = "Stop notifying this browser", description = "A device an admin gets alerts on stays subscribed to those.")
	@DeleteMapping("/subscriptions")
	Unsubscribed unsubscribeFromNotifications(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		return new Unsubscribed(pushService.unsubscribe(endpoint));
	}

	record TestNotificationForm(@NotBlank @Size(max = 1000) String endpoint) {
	}

	@Operation(summary = "Send a test notification to this browser",
			description = "At once, to this subscription only, 20 seconds apart at least; the answer of its push service is told.")
	@PostMapping("/test")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void sendTestNotification(@Valid @RequestBody TestNotificationForm form) {
		pushService.test(form.endpoint(), Instant.now());
	}

}
