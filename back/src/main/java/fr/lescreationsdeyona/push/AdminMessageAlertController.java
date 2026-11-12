package fr.lescreationsdeyona.push;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The devices of the admins told of the messages written to them (2.13), each for the admin who turned it on. */
@Tag(name = "Admin - Message alerts")
@RestController
@RequestMapping("/api/admin/message-alerts")
@RequiredArgsConstructor
class AdminMessageAlertController {

	private final PushService pushService;

	private final AdminSeen adminSeen;

	record MessageAlertStatus(boolean enabled) {
	}

	@Operation(summary = "Whether this device is told of the messages of the admin asking")
	@GetMapping
	MessageAlertStatus getMessageAlert(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		return new MessageAlertStatus(pushService.receivesMessages(endpoint, me()));
	}

	@Operation(summary = "Tell this device of the messages written to the admin asking, when not read at once",
			description = "The body of PushSubscription.toJSON().")
	@PutMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void enableMessageAlert(@Valid @RequestBody PushSubscriptionForm form) {
		pushService.subscribeToMessages(form, me());
	}

	@Operation(summary = "Stop telling this device of the messages")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void disableMessageAlert(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		pushService.unsubscribeFromMessages(endpoint);
	}

	private String me() {
		return adminSeen.admin().orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
	}

}
