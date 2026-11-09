package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.feedback.Recaptcha;
import fr.lescreationsdeyona.shop.ShopForms.OrderForm;
import fr.lescreationsdeyona.shop.ShopResponses.OrderPlaced;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * What stands between the shop and the robots, outside any transaction: no database connection is
 * held while Google answers. A field hidden from people catches the simplest ones, "Je ne suis pas
 * un robot" is Google's reCAPTCHA, and {@link OrderLimits} slows down the others.
 */
@Component
@RequiredArgsConstructor
class ShopOrderIntake {

	private final ShopOrderService orderService;

	private final Recaptcha captcha;

	private final OrderLimits limits;

	OrderPlaced submit(OrderForm form, String sender) {
		// A robot fills every field: answered as a success, so that it learns nothing
		if (StringUtils.hasText(form.website())) {
			return new OrderPlaced(UUID.randomUUID());
		}
		if (!orderService.isOpen()) {
			throw new ApiException(ErrorCode.SHOP_CLOSED);
		}
		Instant now = Instant.now();
		String token = form.captchaToken();
		if (token == null || token.isBlank()) {
			throw new ApiException(ErrorCode.SHOP_CAPTCHA);
		}
		if (limits.tooManyChecks(sender, now)) {
			throw new ApiException(ErrorCode.SHOP_TOO_MANY);
		}
		if (!captcha.accepts(token)) {
			throw new ApiException(ErrorCode.SHOP_CAPTCHA);
		}
		ErrorCode refused = limits.refusal(sender, now);
		if (refused != null) {
			throw new ApiException(refused);
		}
		return orderService.create(form);
	}

}
