package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.feedback.Recaptcha;
import fr.lescreationsdeyona.shop.ShopForms.OrderForm;
import fr.lescreationsdeyona.shop.ShopForms.OrderLineForm;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ShopOrderIntakeTest {

	private final ShopOrderService orders = mock(ShopOrderService.class);

	private final Recaptcha captcha = mock(Recaptcha.class);

	private final ShopOrderIntake intake = new ShopOrderIntake(orders, captcha, new OrderLimits());

	@BeforeEach
	void openAndPassTheCaptcha() {
		when(orders.isOpen()).thenReturn(true);
		when(captcha.accepts(any())).thenReturn(true);
	}

	private static OrderForm form(String website, String token) {
		return new OrderForm("Camille", "camille@example.fr", null, null, null, List.of(new OrderLineForm(1L, 1)), website, token);
	}

	@Test
	void passesAnOrderWithASolvedCaptcha() {
		intake.submit(form(null, "token"), "1.2.3.4");

		verify(orders).create(any());
	}

	@Test
	void answersARobotAsIfAllWentWell() {
		assertThat(intake.submit(form("https://spam.example", "token"), "1.2.3.4").trackingToken()).isNotNull();

		verify(orders, never()).create(any());
		verify(captcha, never()).accepts(any());
	}

	@Test
	void doesNotAskGoogleWhileClosed() {
		when(orders.isOpen()).thenReturn(false);

		assertThatThrownBy(() -> intake.submit(form(null, "token"), "1.2.3.4")).extracting("code").isEqualTo(ErrorCode.SHOP_CLOSED);
		verify(captcha, never()).accepts(any());
	}

	@Test
	void doesNotAskGoogleWithoutAnAnswer() {
		assertThatThrownBy(() -> intake.submit(form(null, " "), "1.2.3.4")).extracting("code").isEqualTo(ErrorCode.SHOP_CAPTCHA);
		verify(captcha, never()).accepts(any());
	}

	@Test
	void refusesAnUnsolvedCaptcha() {
		when(captcha.accepts(any())).thenReturn(false);

		assertThatThrownBy(() -> intake.submit(form(null, "token"), "1.2.3.4")).extracting("code").isEqualTo(ErrorCode.SHOP_CAPTCHA);
		verify(orders, never()).create(any());
	}

	@Test
	void refusesASecondOrderWithinAMinute() {
		intake.submit(form(null, "token"), "1.2.3.4");

		assertThatThrownBy(() -> intake.submit(form(null, "token"), "1.2.3.4")).extracting("code").isEqualTo(ErrorCode.SHOP_TOO_FAST);
	}

}
