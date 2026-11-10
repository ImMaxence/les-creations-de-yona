package fr.lescreationsdeyona.shop;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the shop's pages and the back-office send. */
public final class ShopForms {

	private ShopForms() {
	}

	/** An order, sent by a visitor without any account: products, or something else asked in the message. */
	public record OrderForm(
			@NotBlank @Size(max = 100) String customerName,
			@Schema(description = "An email or a phone number at least") @Email @Size(max = 200) @Nullable String customerEmail,
			@Pattern(regexp = "^$|^[0-9+() .-]{6,30}$") @Nullable String customerPhone,
			@Nullable LocalDate wantedOn,
			@Schema(description = "Free text: what the products do not say, or something else; needed without product")
			@Size(max = 2000) @Nullable String message,
			@Schema(description = "Empty when everything is asked in the message") @NotNull @Size(max = 20) List<@Valid @NotNull OrderLineForm> lines,
			@Schema(description = "Left empty by people: a robot filling every field is ignored") @Nullable String website,
			@Schema(description = "Answer of the reCAPTCHA checkbox") @Size(max = 8000) @Nullable String captchaToken) {
	}

	public record OrderLineForm(@NotNull Long productId, @NotNull @Min(1) @Max(50) Integer quantity) {
	}

	/** What the admin changes on an order. */
	public record AdminOrderForm(
			@NotNull OrderStatus status,
			@Schema(description = "What the customer pays, in euros") @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount,
			@Schema(description = "Seen by the admins only") @Size(max = 2000) @Nullable String adminNote,
			@Schema(description = "Email of the admin in charge; absent for the one saving it") @Size(max = 254) @Nullable String handledBy) {
	}

	/** A product: its name and photo come from its recipe at first, and may be changed. */
	public record ShopProductForm(
			@Schema(description = "Its recipe; absent for a product without recipe") @Nullable Long recipeId,
			@NotBlank @Size(max = 150) String name,
			@Schema(description = "A landscape photo of the gallery; absent shows its recipe's") @Nullable UUID imageId,
			@Schema(description = "For a product without recipe; one with a recipe has the recipe's") @Nullable Long categoryId,
			@Schema(description = "Including taxes, for the format as bought (the whole batch)") @NotNull @DecimalMin("0") @Digits(integer = 6, fraction = 2) BigDecimal price,
			@Schema(description = "\"le gâteau, 8 parts\"") @Size(max = 100) @Nullable String portionLabel,
			@Schema(description = "Sold by batches of that many (\"Boîte de 6\"); absent by the unit") @Min(2) @Max(1000) @Nullable Integer batchSize,
			@Schema(description = "Share of its recipe in one product, for the cost price: 1 for the whole recipe; 1 when absent")
			@DecimalMin("0.001") @Digits(integer = 3, fraction = 3) @Nullable BigDecimal recipeShare,
			@Schema(description = "Packaging as written in the purchases (\"Boîte kraft\"), for the cost price") @Size(max = 100) @Nullable String packaging,
			@Schema(description = "How many of that packaging; 1 when absent") @Min(1) @Max(100) @Nullable Integer packagingCount,
			@NotNull Boolean available) {
	}

	public record ShopSettingsForm(
			@NotNull ShopMode mode,
			@Schema(description = "Where and when to fetch an order") @Size(max = 1000) @Nullable String pickupInfo) {
	}

}
