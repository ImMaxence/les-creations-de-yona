package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.accounting.AccountingService;
import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.security.AdminProperties;
import fr.lescreationsdeyona.shop.ShopForms.AdminOrderForm;
import fr.lescreationsdeyona.shop.ShopForms.OrderForm;
import fr.lescreationsdeyona.shop.ShopForms.OrderLineForm;
import fr.lescreationsdeyona.shop.ShopResponses.AdminOrder;
import fr.lescreationsdeyona.shop.ShopResponses.AdminOrderLine;
import fr.lescreationsdeyona.shop.ShopResponses.AdminOrderSummary;
import fr.lescreationsdeyona.shop.ShopResponses.OrderPlaced;
import fr.lescreationsdeyona.shop.ShopResponses.OrderTracking;
import fr.lescreationsdeyona.shop.ShopResponses.TrackedLine;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * The orders: created from the shop (see {@link ShopOrderIntake} for the robots), followed by the
 * customer through a secret link, handled in the back-office. Handed over, the money enters the
 * accounts. Kept 12 months after being finished.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopOrderService {

	static final Duration KEPT = Duration.ofDays(365);

	/** Orders nobody has looked at: beyond this, robots got through and the shop stops taking more. */
	static final int MAX_NEW = 500;

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private static final Logger log = LoggerFactory.getLogger(ShopOrderService.class);

	private final ShopOrderRepository orderRepository;

	private final ShopProductRepository productRepository;

	private final ShopSettingsRepository settingsRepository;

	private final AccountingService accountingService;

	private final AdminProperties adminProperties;

	private final AuditorAware<String> auditor;

	private final ApplicationEventPublisher events;

	private final AuditLog auditLog;

	boolean isOpen() {
		return settingsRepository.findById(ShopSettings.ID).map(ShopSettings::isOrdersOpen).orElse(false);
	}

	/** The admins are told once it is committed (see OrderReceived). */
	@Transactional
	public OrderPlaced create(OrderForm form) {
		if (!isOpen()) {
			throw new ApiException(ErrorCode.SHOP_CLOSED);
		}
		if (orderRepository.countByStatus(OrderStatus.NEW) >= MAX_NEW) {
			throw new ApiException(ErrorCode.SHOP_FULL);
		}
		String email = blankToNull(form.customerEmail());
		String phone = blankToNull(form.customerPhone());
		if (email == null && phone == null) {
			throw new ApiException(ErrorCode.SHOP_CONTACT_REQUIRED);
		}
		if (form.wantedOn() != null && form.wantedOn().isBefore(LocalDate.now(PARIS))) {
			throw new ApiException(ErrorCode.SHOP_WANTED_DATE_PAST);
		}
		List<ShopOrderLine> lines = lines(form.lines());
		Instant now = Instant.now();
		ShopOrder order = new ShopOrder();
		order.setTrackingToken(UUID.randomUUID());
		order.setStatus(OrderStatus.NEW);
		order.setCustomerName(form.customerName().strip());
		order.setCustomerEmail(email);
		order.setCustomerPhone(phone);
		order.setWantedOn(form.wantedOn());
		order.setMessage(blankToNull(form.message()));
		order.setAmount(lines.stream()
			.map(line -> line.unitPrice().multiply(BigDecimal.valueOf(line.quantity())))
			.reduce(BigDecimal.ZERO, BigDecimal::add));
		order.setCreatedAt(now);
		order.setUpdatedAt(now);
		order.getLines().addAll(lines);
		ShopOrder saved = orderRepository.saveAndFlush(order);
		events.publishEvent(new OrderReceived(saved.getId(), itemCount(saved), saved.getAmount()));
		return new OrderPlaced(saved.getTrackingToken());
	}

	/** On sale now, each once; what they cost today is kept with the order. */
	private List<ShopOrderLine> lines(List<OrderLineForm> formLines) {
		List<Long> ids = formLines.stream().map(OrderLineForm::productId).toList();
		if (new HashSet<>(ids).size() < ids.size()) {
			throw new ApiException(ErrorCode.SHOP_PRODUCT_DUPLICATE);
		}
		Map<Long, ShopProduct> products = productRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(ShopProduct::getId, Function.identity()));
		return formLines.stream().map(line -> {
			ShopProduct product = products.get(line.productId());
			if (product == null || !product.isAvailable() || product.getRecipe().getStatus() != RecipeStatus.PUBLISHED) {
				throw new ApiException(ErrorCode.SHOP_PRODUCT_UNAVAILABLE);
			}
			Recipe recipe = product.getRecipe();
			return new ShopOrderLine(recipe.getId(), recipe.getTitle(), product.getPortionLabel(), product.getPrice(), line.quantity());
		}).toList();
	}

	public OrderTracking track(UUID token) {
		ShopOrder order = orderRepository.findByTrackingToken(token)
			.orElseThrow(() -> new ApiException(ErrorCode.SHOP_ORDER_NOT_FOUND));
		return new OrderTracking(order.getId(), order.getStatus(), order.getWantedOn(), order.getAmount(),
				order.getLines().stream()
					.map(line -> new TrackedLine(line.title(), line.portionLabel(), line.unitPrice(), line.quantity()))
					.toList(),
				order.getCreatedAt(), order.getUpdatedAt());
	}

	// Back-office

	public PageResponse<AdminOrderSummary> list(@Nullable OrderStatus status, Pageable pageable) {
		return PageResponse.of(orderRepository.findLatest(status, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(order -> new AdminOrderSummary(order.getId(), order.getStatus(), order.getCustomerName(), order.getWantedOn(),
					order.getAmount(), itemCount(order), order.getHandledBy(), order.getCreatedAt())));
	}

	public long newCount() {
		return orderRepository.countByStatus(OrderStatus.NEW);
	}

	public AdminOrder get(long id) {
		return toAdmin(find(id));
	}

	/** Handed over, the money enters the accounts of the admin in charge; a step back takes it out. */
	@Transactional
	public AdminOrder update(long id, AdminOrderForm form) {
		ShopOrder order = find(id);
		String handledBy = handledBy(order, form.handledBy());
		AuditChanges changes = new AuditChanges().add("Statut", status(order.getStatus()), status(form.status()))
			.add("Montant", order.getAmount(), form.amount())
			.add("Note", order.getAdminNote(), form.adminNote())
			.add("En charge", order.getHandledBy(), handledBy);
		order.setStatus(form.status());
		order.setAmount(form.amount());
		order.setAdminNote(blankToNull(form.adminNote()));
		order.setHandledBy(handledBy);
		order.setUpdatedAt(Instant.now());
		ShopOrder saved = orderRepository.saveAndFlush(order);
		if (saved.getStatus() == OrderStatus.PICKED_UP) {
			accountingService.recordSale(saved.getId(), saved.getAmount(), handledBy);
		}
		else {
			accountingService.dropSale(saved.getId());
		}
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_ORDER, label(saved), id, changes);
		return toAdmin(saved);
	}

	/** For good (spam, a mistake); its line in the accounts goes with it. */
	@Transactional
	public void delete(long id) {
		ShopOrder order = find(id);
		accountingService.dropSale(id);
		auditLog.record(AuditAction.DELETED, AuditKind.SHOP_ORDER, label(order), null);
		orderRepository.delete(order);
	}

	/** Every night, the orders finished for 12 months. */
	@Scheduled(cron = "0 55 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		int erased = orderRepository.deleteFinishedBefore(Instant.now().minus(KEPT));
		if (erased > 0) {
			log.info("{} order(s) erased 12 months after being finished", erased);
		}
	}

	/** The admin chosen, the one already in charge, or the one saving it. */
	private String handledBy(ShopOrder order, @Nullable String chosen) {
		String email = StringUtils.hasText(chosen) ? chosen.strip() : order.getHandledBy();
		if (email == null) {
			return auditor.getCurrentAuditor().orElseThrow();
		}
		if (!email.equals(order.getHandledBy()) && !adminProperties.isAdmin(email)) {
			throw new ApiException(ErrorCode.SHOP_ADMIN_UNKNOWN);
		}
		return email;
	}

	private ShopOrder find(long id) {
		return orderRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.SHOP_ORDER_NOT_FOUND));
	}

	private static int itemCount(ShopOrder order) {
		return order.getLines().stream().mapToInt(ShopOrderLine::quantity).sum();
	}

	/** No name in the history: it is kept 6 months, and orders may be erased before. */
	private static String label(ShopOrder order) {
		return "Commande n° " + order.getId();
	}

	private static String status(OrderStatus status) {
		return switch (status) {
			case NEW -> "Nouvelle";
			case ACCEPTED -> "Acceptée";
			case IN_PREPARATION -> "En préparation";
			case READY -> "Prête";
			case PICKED_UP -> "Récupérée";
			case CANCELLED -> "Annulée";
		};
	}

	private AdminOrder toAdmin(ShopOrder order) {
		return new AdminOrder(order.getId(), order.getTrackingToken(), order.getStatus(), order.getCustomerName(),
				order.getCustomerEmail(), order.getCustomerPhone(), order.getWantedOn(), order.getMessage(), order.getAdminNote(),
				order.getAmount(), order.getHandledBy(), adminProperties.emails().stream().sorted().toList(),
				order.getLines().stream()
					.map(line -> new AdminOrderLine(line.recipeId(), line.title(), line.portionLabel(), line.unitPrice(), line.quantity()))
					.toList(),
				order.getCreatedAt(), order.getUpdatedAt());
	}

	private static @Nullable String blankToNull(@Nullable String text) {
		return StringUtils.hasText(text) ? text.strip() : null;
	}

}
