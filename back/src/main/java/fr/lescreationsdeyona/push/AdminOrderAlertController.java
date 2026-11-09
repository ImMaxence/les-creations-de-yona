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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The devices of the admins told of each new order. */
@Tag(name = "Admin - Order alerts")
@RestController
@RequestMapping("/api/admin/order-alerts")
@RequiredArgsConstructor
class AdminOrderAlertController {

	private final PushService pushService;

	record OrderAlertStatus(boolean enabled) {
	}

	@Operation(summary = "Whether this device is told of new orders")
	@GetMapping
	OrderAlertStatus getOrderAlert(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		return new OrderAlertStatus(pushService.receivesOrders(endpoint));
	}

	@Operation(summary = "Tell this device of each new order", description = "The body of PushSubscription.toJSON().")
	@PutMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void enableOrderAlert(@Valid @RequestBody PushSubscriptionForm form) {
		pushService.subscribeToOrders(form);
	}

	@Operation(summary = "Stop telling this device of new orders")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void disableOrderAlert(@RequestParam @NotBlank @Size(max = 1000) String endpoint) {
		pushService.unsubscribeFromOrders(endpoint);
	}

}
