package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.shop.ShopForms.AdminOrderForm;
import fr.lescreationsdeyona.shop.ShopForms.ShopProductForm;
import fr.lescreationsdeyona.shop.ShopForms.ShopSettingsForm;
import fr.lescreationsdeyona.shop.ShopResponses.AdminOrder;
import fr.lescreationsdeyona.shop.ShopResponses.AdminOrderSummary;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopProduct;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopSettings;
import fr.lescreationsdeyona.shop.ShopResponses.NewOrdersCount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Shop")
@RestController
@RequestMapping("/api/admin/shop")
@RequiredArgsConstructor
class AdminShopController {

	private final ShopService shopService;

	private final ShopOrderService orderService;

	@Operation(summary = "The shop's settings")
	@GetMapping("/settings")
	AdminShopSettings getShopSettings() {
		return shopService.adminSettings();
	}

	@Operation(summary = "Open or close the shop, change what it says")
	@PutMapping("/settings")
	AdminShopSettings updateShopSettings(@Valid @RequestBody ShopSettingsForm form) {
		return shopService.updateSettings(form);
	}

	@Operation(summary = "The recipes offered in the shop, by title")
	@GetMapping("/products")
	List<AdminShopProduct> listShopProducts() {
		return shopService.adminProducts();
	}

	@Operation(summary = "Offer a recipe in the shop")
	@PostMapping("/products")
	@ResponseStatus(HttpStatus.CREATED)
	AdminShopProduct createShopProduct(@Valid @RequestBody ShopProductForm form) {
		return shopService.createProduct(form);
	}

	@Operation(summary = "Change the price or the availability of a product; its recipe stays")
	@PutMapping("/products/{id}")
	AdminShopProduct updateShopProduct(@PathVariable long id, @Valid @RequestBody ShopProductForm form) {
		return shopService.updateProduct(id, form);
	}

	@Operation(summary = "Take a recipe out of the shop; it stays on the blog")
	@DeleteMapping("/products/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteShopProduct(@PathVariable long id) {
		shopService.deleteProduct(id);
	}

	@Operation(summary = "The orders, the latest first, optionally of one status")
	@GetMapping("/orders")
	PageResponse<AdminOrderSummary> listShopOrders(@RequestParam(required = false) @Nullable OrderStatus status,
			@ParameterObject @PageableDefault(size = 20) Pageable pageable) {
		return orderService.list(status, pageable);
	}

	@Operation(summary = "The number of orders nobody has handled yet")
	@GetMapping("/orders/new-count")
	NewOrdersCount countNewShopOrders() {
		return new NewOrdersCount(orderService.newCount());
	}

	@Operation(summary = "An order, with the customer's contact")
	@GetMapping("/orders/{id}")
	AdminOrder getShopOrder(@PathVariable long id) {
		return orderService.get(id);
	}

	@Operation(summary = "Change the status, the amount, the note or the admin in charge of an order",
			description = "Set to PICKED_UP, its amount enters the accounts of the admin in charge; moved back, it leaves them.")
	@PutMapping("/orders/{id}")
	AdminOrder updateShopOrder(@PathVariable long id, @Valid @RequestBody AdminOrderForm form) {
		return orderService.update(id, form);
	}

	@Operation(summary = "Delete an order for good (spam, a mistake), and its line in the accounts")
	@DeleteMapping("/orders/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteShopOrder(@PathVariable long id) {
		orderService.delete(id);
	}

}
