package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.accounting.AccountingService;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.security.AdminProperties;
import fr.lescreationsdeyona.shop.ShopForms.AdminOrderForm;
import fr.lescreationsdeyona.shop.ShopForms.OrderForm;
import fr.lescreationsdeyona.shop.ShopForms.OrderLineForm;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.AuditorAware;

class ShopOrderServiceTest {

	private final ShopOrderRepository orders = mock(ShopOrderRepository.class);

	private final ShopProductRepository products = mock(ShopProductRepository.class);

	private final ShopSettingsRepository settingsRepository = mock(ShopSettingsRepository.class);

	private final AccountingService accounting = mock(AccountingService.class);

	private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);

	@SuppressWarnings("unchecked")
	private final AuditorAware<String> auditor = mock(AuditorAware.class);

	private final ShopOrderService service = new ShopOrderService(orders, products, settingsRepository, accounting,
			new AdminProperties(Set.of("yona@example.fr", "max@example.fr")), auditor, events, mock(AuditLog.class));

	private final ShopSettings settings = new ShopSettings();

	@BeforeEach
	void openShop() {
		settings.setOrdersOpen(true);
		when(settingsRepository.findById(ShopSettings.ID)).thenReturn(Optional.of(settings));
		when(orders.saveAndFlush(any())).thenAnswer(invocation -> {
			ShopOrder order = invocation.getArgument(0);
			if (order.getId() == null) {
				order.setId(12L);
			}
			return order;
		});
		when(auditor.getCurrentAuditor()).thenReturn(Optional.of("yona@example.fr"));
		when(products.findAllById(any())).thenReturn(List.of(product(1L, "Tarte", "24.50", RecipeStatus.PUBLISHED, true),
				product(2L, "Cake", "12.00", RecipeStatus.PUBLISHED, true)));
	}

	private static ShopProduct product(long id, String title, String price, RecipeStatus status, boolean available) {
		Recipe recipe = new Recipe();
		recipe.setId(100 + id);
		recipe.setTitle(title);
		recipe.setStatus(status);
		ShopProduct product = new ShopProduct();
		product.setId(id);
		product.setRecipe(recipe);
		product.setPrice(new BigDecimal(price));
		product.setPortionLabel("Pour 8");
		product.setAvailable(available);
		return product;
	}

	private static OrderForm form(String email, String phone, LocalDate wantedOn, OrderLineForm... lines) {
		return new OrderForm("  Camille  ", email, phone, wantedOn, "  Sans noix  ", List.of(lines), null, "token");
	}

	private static OrderLineForm line(long productId, int quantity) {
		return new OrderLineForm(productId, quantity);
	}

	private ShopOrder savedOrder() {
		ArgumentCaptor<ShopOrder> saved = ArgumentCaptor.forClass(ShopOrder.class);
		verify(orders).saveAndFlush(saved.capture());
		return saved.getValue();
	}

	private ShopOrder existingOrder(OrderStatus status, String handledBy) {
		ShopOrder order = new ShopOrder();
		order.setId(12L);
		order.setStatus(status);
		order.setAmount(new BigDecimal("30.00"));
		order.setHandledBy(handledBy);
		when(orders.findById(12L)).thenReturn(Optional.of(order));
		return order;
	}

	@Test
	void keepsTheOrderAsItIsToday() {
		service.create(form("camille@example.fr", " ", null, line(1, 2), line(2, 1)));

		ShopOrder order = savedOrder();
		assertThat(order.getStatus()).isEqualTo(OrderStatus.NEW);
		assertThat(order.getCustomerName()).isEqualTo("Camille");
		assertThat(order.getCustomerPhone()).isNull();
		assertThat(order.getMessage()).isEqualTo("Sans noix");
		assertThat(order.getAmount()).isEqualByComparingTo("61.00");
		assertThat(order.getTrackingToken()).isNotNull();
		assertThat(order.getLines()).extracting(ShopOrderLine::title).containsExactly("Tarte", "Cake");
		assertThat(order.getLines().getFirst().unitPrice()).isEqualByComparingTo("24.50");
	}

	@Test
	void tellsTheAdminsOfTheOrderWithoutTheCustomer() {
		service.create(form("camille@example.fr", null, null, line(1, 2), line(2, 1)));

		BigDecimal amount = savedOrder().getAmount();
		verify(events).publishEvent(eq(new OrderReceived(12L, 3, amount)));
	}

	@Test
	void refusesAnOrderWhileClosed() {
		settings.setOrdersOpen(false);

		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, null, line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_CLOSED);
	}

	@Test
	void asksForAWayToAnswer() {
		assertThatThrownBy(() -> service.create(form(" ", "", null, line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_CONTACT_REQUIRED);
	}

	@Test
	void refusesADateAlreadyPast() {
		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, LocalDate.of(2020, 1, 1), line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_WANTED_DATE_PAST);
	}

	@Test
	void refusesAProductNoLongerOnSale() {
		when(products.findAllById(any())).thenReturn(List.of(product(1L, "Tarte", "24.50", RecipeStatus.PUBLISHED, false)));

		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, null, line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_PRODUCT_UNAVAILABLE);
	}

	@Test
	void refusesAProductWhoseRecipeLeftTheSite() {
		when(products.findAllById(any())).thenReturn(List.of(product(1L, "Tarte", "24.50", RecipeStatus.DRAFT, true)));

		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, null, line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_PRODUCT_UNAVAILABLE);
	}

	@Test
	void refusesTheSameProductTwice() {
		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, null, line(1, 1), line(1, 2))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_PRODUCT_DUPLICATE);
	}

	@Test
	void stopsTakingOrdersWhenTooManyAreWaiting() {
		when(orders.countByStatus(OrderStatus.NEW)).thenReturn((long) ShopOrderService.MAX_NEW);

		assertThatThrownBy(() -> service.create(form("camille@example.fr", null, null, line(1, 1))))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_FULL);
	}

	@Test
	void entersTheAccountsOfTheAdminInChargeOnceHandedOver() {
		existingOrder(OrderStatus.READY, "max@example.fr");

		service.update(12, new AdminOrderForm(OrderStatus.PICKED_UP, new BigDecimal("28.00"), null, null));

		verify(accounting).recordSale(12L, new BigDecimal("28.00"), "max@example.fr");
		verify(accounting, never()).dropSale(12L);
	}

	@Test
	void leavesTheAccountsWhenMovedBack() {
		existingOrder(OrderStatus.PICKED_UP, "max@example.fr");

		service.update(12, new AdminOrderForm(OrderStatus.READY, new BigDecimal("30.00"), null, null));

		verify(accounting).dropSale(12L);
		verify(accounting, never()).recordSale(any(Long.class), any(), any());
	}

	@Test
	void givesTheOrderToTheFirstAdminHandlingIt() {
		ShopOrder order = existingOrder(OrderStatus.NEW, null);

		service.update(12, new AdminOrderForm(OrderStatus.ACCEPTED, new BigDecimal("30.00"), " ", null));

		assertThat(order.getHandledBy()).isEqualTo("yona@example.fr");
		assertThat(order.getAdminNote()).isNull();
	}

	@Test
	void refusesToGiveAnOrderToSomeoneElse() {
		existingOrder(OrderStatus.NEW, null);

		assertThatThrownBy(() -> service.update(12, new AdminOrderForm(OrderStatus.ACCEPTED, BigDecimal.TEN, null, "autre@example.fr")))
			.extracting("code")
			.isEqualTo(ErrorCode.SHOP_ADMIN_UNKNOWN);
	}

	@Test
	void keepsAnAdminWhoLeftOnTheirOrder() {
		ShopOrder order = existingOrder(OrderStatus.ACCEPTED, "parti@example.fr");

		service.update(12, new AdminOrderForm(OrderStatus.READY, BigDecimal.TEN, null, "parti@example.fr"));

		assertThat(order.getHandledBy()).isEqualTo("parti@example.fr");
	}

	@Test
	void deletesAnOrderWithItsLineInTheAccounts() {
		ShopOrder order = existingOrder(OrderStatus.PICKED_UP, "max@example.fr");

		service.delete(12);

		verify(accounting).dropSale(12L);
		verify(orders).delete(order);
	}

}
