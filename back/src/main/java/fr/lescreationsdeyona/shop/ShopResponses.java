package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.shop.InvoiceResponses.InvoiceSummary;
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
	public record ShopPage(ShopMode mode,
			@Schema(description = "Orders come in: for the close ones, or for all") boolean open,
			@Nullable String pickupInfo, List<ShopProductCard> products) {
	}

	/** Prices include taxes. */
	public record ShopProductCard(Long id, String name, @Nullable UUID imageId, BigDecimal price,
			@Schema(description = "\"Boîte de 6\", or \"À l'unité\"") String format,
			@Schema(description = "\"le gâteau, 8 parts\"") @Nullable String portionLabel,
			@Schema(description = "Sold by batches of that many; absent by the unit") @Nullable Integer batchSize,
			@Schema(description = "Price of one piece of a batch, to the cent") @Nullable BigDecimal unitPrice,
			@Schema(description = "Its recipe's categories, the main one first, or its own") List<ShopCategory> categories) {
	}

	public record ShopCategory(String slug, String name) {
	}

	public record OrderPlaced(@Schema(description = "The secret of the customer's link") UUID trackingToken) {
	}

	/** What the customer's link shows: no name and no contact, a link can be passed on. */
	public record OrderTracking(Long number, OrderStatus status, @Nullable LocalDate wantedOn, BigDecimal amount,
			@Schema(description = "Empty for a request made in the message only") List<TrackedLine> lines, Instant createdAt,
			Instant updatedAt) {
	}

	public record TrackedLine(String title, @Nullable String portionLabel, BigDecimal unitPrice, int quantity) {
	}

	public record AdminOrderSummary(Long id, OrderStatus status, String customerName, @Nullable LocalDate wantedOn,
			BigDecimal amount, int itemCount, @Nullable String handledBy, Instant createdAt) {
	}

	public record AdminOrder(Long id, UUID trackingToken, OrderStatus status, String customerName,
			@Nullable String customerEmail, @Nullable String customerPhone, @Nullable LocalDate wantedOn, @Nullable String message,
			@Nullable String adminNote, BigDecimal amount, @Nullable String handledBy,
			@Schema(description = "Those who can be in charge") List<String> admins, List<AdminOrderLine> lines,
			@Schema(description = "Its invoice, once issued") @Nullable InvoiceSummary invoice, Instant createdAt,
			Instant updatedAt) {
	}

	public record AdminOrderLine(@Nullable Long productId, @Nullable Long recipeId, String title, @Nullable String portionLabel,
			BigDecimal unitPrice, int quantity) {
	}

	public record AdminShopProduct(Long id, @Nullable Long recipeId, @Nullable String recipeTitle,
			@Nullable RecipeStatus recipeStatus, String name,
			@Schema(description = "Its own photo; absent shows its recipe's") @Nullable UUID imageId,
			@Schema(description = "The photo shown: its own, or its recipe's") @Nullable UUID shownImageId,
			@Schema(description = "Its own category, without recipe") @Nullable Long categoryId,
			@Schema(description = "The categories it is found under in the shop") List<String> categoryNames, BigDecimal price,
			String format, @Nullable String portionLabel, @Nullable Integer batchSize, @Nullable BigDecimal unitPrice,
			BigDecimal recipeShare, @Nullable String packaging, int packagingCount, boolean available,
			@Schema(description = "Available, and its recipe published if any") boolean onSale, Instant updatedAt) {
	}

	public record AdminShopSettings(ShopMode mode, @Nullable String pickupInfo, Instant updatedAt) {
	}

	public record NewOrdersCount(long count) {
	}

}
