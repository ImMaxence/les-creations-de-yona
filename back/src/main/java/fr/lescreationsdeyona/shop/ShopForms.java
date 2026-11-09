package fr.lescreationsdeyona.shop;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the shop's pages and the back-office send. */
public final class ShopForms {

	private ShopForms() {
	}

	/** An order, sent by a visitor without any account. */
	public record OrderForm(
			@NotBlank @Size(max = 100) String customerName,
			@Schema(description = "An email or a phone number at least") @Email @Size(max = 200) @Nullable String customerEmail,
			@Pattern(regexp = "^$|^[0-9+() .-]{6,30}$") @Nullable String customerPhone,
			@Nullable LocalDate wantedOn,
			@Schema(description = "Free text: what the recipes do not say") @Size(max = 2000) @Nullable String message,
			@NotEmpty @Size(max = 20) List<@Valid @NotNull OrderLineForm> lines,
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

	public record ShopProductForm(
			@NotNull Long recipeId,
			@NotNull @DecimalMin("0") @Digits(integer = 6, fraction = 2) BigDecimal price,
			@Schema(description = "\"Pour 8 personnes\"") @Size(max = 100) @Nullable String portionLabel,
			@NotNull Boolean available) {
	}

	public record ShopSettingsForm(
			@NotNull Boolean ordersOpen,
			@NotBlank @Size(max = 1000) String intro,
			@Schema(description = "Where and when to fetch an order") @Size(max = 1000) @Nullable String pickupInfo) {
	}

}
