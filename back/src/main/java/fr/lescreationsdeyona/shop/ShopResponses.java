package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the API answers about the shop. */
public final class ShopResponses {

	private ShopResponses() {
	}

	/** The shop page; no product while it is closed. */
	public record ShopPage(boolean open, String intro, @Nullable String pickupInfo, List<ShopProductCard> products) {
	}

	public record ShopProductCard(Long id, String title, String slug, String categorySlug, @Nullable String intro,
			@Nullable UUID imageId, BigDecimal price, @Nullable String portionLabel) {
	}

	public record OrderPlaced(@Schema(description = "The secret of the customer's link") UUID trackingToken) {
	}

	/** What the customer's link shows: no name and no contact, a link can be passed on. */
	public record OrderTracking(Long number, OrderStatus status, @Nullable LocalDate wantedOn, BigDecimal amount,
			List<TrackedLine> lines, Instant createdAt, Instant updatedAt) {
	}

	public record TrackedLine(String title, @Nullable String portionLabel, BigDecimal unitPrice, int quantity) {
	}

	public record AdminOrderSummary(Long id, OrderStatus status, String customerName, @Nullable LocalDate wantedOn,
			BigDecimal amount, int itemCount, @Nullable String handledBy, Instant createdAt) {
	}

	public record AdminOrder(Long id, UUID trackingToken, OrderStatus status, String customerName,
			@Nullable String customerEmail, @Nullable String customerPhone, @Nullable LocalDate wantedOn, @Nullable String message,
			@Nullable String adminNote, BigDecimal amount, @Nullable String handledBy,
			@Schema(description = "Those who can be in charge") List<String> admins, List<AdminOrderLine> lines, Instant createdAt,
			Instant updatedAt) {
	}

	public record AdminOrderLine(@Nullable Long recipeId, String title, @Nullable String portionLabel, BigDecimal unitPrice,
			int quantity) {
	}

	public record AdminShopProduct(Long id, Long recipeId, String recipeTitle, RecipeStatus recipeStatus, @Nullable UUID imageId,
			BigDecimal price, @Nullable String portionLabel, boolean available, Instant updatedAt) {
	}

	public record AdminShopSettings(boolean ordersOpen, String intro, @Nullable String pickupInfo, Instant updatedAt) {
	}

	public record NewOrdersCount(long count) {
	}

}
