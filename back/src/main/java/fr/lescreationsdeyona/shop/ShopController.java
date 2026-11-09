package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.common.ClientAddress;
import fr.lescreationsdeyona.shop.ShopForms.OrderForm;
import fr.lescreationsdeyona.shop.ShopResponses.OrderPlaced;
import fr.lescreationsdeyona.shop.ShopResponses.OrderTracking;
import fr.lescreationsdeyona.shop.ShopResponses.ShopPage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Shop")
@RestController
@RequestMapping("/api/shop")
@RequiredArgsConstructor
class ShopController {

	private final ShopService shopService;

	private final ShopOrderService orderService;

	private final ShopOrderIntake intake;

	@Operation(summary = "The shop: whether it is open, and the recipes on sale")
	@GetMapping
	ShopPage getShop() {
		return shopService.page();
	}

	@Operation(summary = "An order, sent by a visitor without any account; nothing is paid on the site",
			description = "No CSRF token: visitors have none. Needs the reCAPTCHA's answer (public key: GET /api/feedback/captcha). "
					+ "From an address, one order a minute and 5 an hour at most; 30 an hour for the whole site.")
	@PostMapping("/orders")
	@ResponseStatus(HttpStatus.CREATED)
	OrderPlaced placeOrder(@Valid @RequestBody OrderForm form, HttpServletRequest request) {
		return intake.submit(form, ClientAddress.of(request));
	}

	@Operation(summary = "Where an order stands, from the customer's secret link", description = "No name and no contact in it.")
	@GetMapping("/orders/{token}")
	OrderTracking trackOrder(@PathVariable UUID token) {
		return orderService.track(token);
	}

}
