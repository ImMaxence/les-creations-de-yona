package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.AccountEntryForm.PurchaseLineForm;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountTotals;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import fr.lescreationsdeyona.accounting.AccountingResponses.AdminTotals;
import fr.lescreationsdeyona.accounting.AccountingResponses.BestSeller;
import fr.lescreationsdeyona.accounting.AccountingResponses.CategoryTotal;
import fr.lescreationsdeyona.accounting.AccountingResponses.KeyFigures;
import fr.lescreationsdeyona.accounting.AccountingResponses.MonthTotals;
import fr.lescreationsdeyona.accounting.AccountingResponses.ProductCost;
import fr.lescreationsdeyona.accounting.AccountingResponses.PurchaseLineResponse;
import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ImageStorage;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.security.AdminProperties;
import fr.lescreationsdeyona.shop.OrderStatus;
import fr.lescreationsdeyona.shop.ShopOrder;
import fr.lescreationsdeyona.shop.ShopOrderLine;
import fr.lescreationsdeyona.shop.ShopOrderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The accounts of the shop: the orders handed over come in by themselves, the rest is typed by the
 * admins, and each line is counted for one of them. Kept for good, backed up with the site: the
 * lines hold nothing about the customers. An expense may be detailed (what was bought, at what price),
 * which gives the cost price of the products and the margin of each sale.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountingService {

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private static final DateTimeFormatter CSV_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private static final int BEST_SELLERS = 10;

	/** Expenses, as "Où part l'argent" shows them. */
	private static final List<AccountCategory> EXPENSE_CATEGORIES = List.of(AccountCategory.INGREDIENTS, AccountCategory.PACKAGING,
			AccountCategory.EQUIPMENT, AccountCategory.OTHER);

	private final AccountEntryRepository repository;

	private final AdminProperties adminProperties;

	private final AuditLog auditLog;

	private final ShopOrderRepository orderRepository;

	private final IngredientRepository ingredientRepository;

	private final CostPriceService costPriceService;

	private final ImageService imageService;

	/** The whole year. */
	public AccountingOverview overview(int year) {
		return overview(year, AccountPeriod.YEAR, 1);
	}

	/** {@code number}: the month (1 to 12) or the quarter (1 to 4) of {@code year}; ignored for a year. */
	public AccountingOverview overview(int year, AccountPeriod period, int number) {
		LocalDate from = period.start(year, number);
		LocalDate to = period.end(year, number);
		List<AccountEntry> ofYear = ofYear(year);
		List<AccountEntry> entries = ofYear.stream().filter(entry -> within(entry.getOccurredOn(), from, to)).toList();
		List<AccountEntry> before = repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(from.minusYears(1), to.minusYears(1));
		TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
		years.addAll(repository.findYears());
		years.add(year);
		years.add(LocalDate.now(PARIS).getYear());
		TreeSet<String> admins = new TreeSet<>(adminProperties.emails());
		entries.forEach(entry -> admins.add(entry.getAdminEmail()));
		Map<Integer, List<AccountEntry>> byMonth = ofYear.stream()
			.collect(Collectors.groupingBy(entry -> entry.getOccurredOn().getMonthValue()));
		Map<String, List<AccountEntry>> byAdmin = entries.stream()
			.collect(Collectors.groupingBy(AccountEntry::getAdminEmail, TreeMap::new, Collectors.toList()));
		Map<Long, ShopOrder> orders = ordersOf(entries);
		Map<Long, ProductCost> costs = orders.isEmpty() ? Map.of() : costPriceService.costsById();
		return new AccountingOverview(year, period, period == AccountPeriod.YEAR ? 1 : number, from, to, List.copyOf(years),
				List.copyOf(admins), totals(entries), totals(before), figures(entries, from, to),
				IntStream.rangeClosed(1, 12).mapToObj(month -> new MonthTotals(month, totals(byMonth.getOrDefault(month, List.of())))).toList(),
				byAdmin.entrySet().stream().map(admin -> new AdminTotals(admin.getKey(), totals(admin.getValue()))).toList(),
				expensesByCategory(entries), bestSellers(entries, orders, costs),
				entries.stream()
					.map(entry -> toResponse(entry, entry.getOrderId() == null ? null : orders.get(entry.getOrderId()), costs))
					.toList());
	}

	/** For a spreadsheet: semicolons, decimal commas and a BOM, as French Excel reads them. */
	public String csv(int year) {
		StringBuilder csv = new StringBuilder("﻿Date;Type;Catégorie;Libellé;Montant;Admin;Commande\r\n");
		for (AccountEntry entry : ofYear(year).reversed()) {
			csv.append(CSV_DATE.format(entry.getOccurredOn())).append(';')
				.append(entry.getKind() == AccountKind.INCOME ? "Entrée" : "Dépense").append(';')
				.append(categoryLabel(entry.getCategory())).append(';')
				.append(csvText(entry.getLabel())).append(';')
				.append(entry.getAmount().toPlainString().replace('.', ',')).append(';')
				.append(csvText(entry.getAdminEmail())).append(';')
				.append(entry.getOrderId() == null ? "" : entry.getOrderId())
				.append("\r\n");
		}
		return csv.toString();
	}

	@Transactional
	public AccountEntryResponse create(AccountEntryForm form) {
		checkCategory(form.kind(), form.category());
		checkAdmin(form.adminEmail(), null);
		AccountEntry entry = new AccountEntry();
		entry.setKind(form.kind());
		entry.setCategory(form.category());
		applyAmount(form, entry);
		apply(form, entry);
		AccountEntry saved = repository.saveAndFlush(entry);
		auditLog.record(AuditAction.CREATED, AuditKind.ACCOUNT_ENTRY, saved.getLabel(), saved.getId());
		return toResponse(saved, null, Map.of());
	}

	/** A line coming from an order keeps its kind, category and amount: those follow the order. */
	@Transactional
	public AccountEntryResponse update(long id, AccountEntryForm form) {
		AccountEntry entry = find(id);
		checkCategory(form.kind(), form.category());
		checkAdmin(form.adminEmail(), entry.getAdminEmail());
		if (entry.getOrderId() != null && (entry.getKind() != form.kind() || entry.getCategory() != form.category()
				|| entry.getAmount().compareTo(form.amount()) != 0 || !purchases(form).isEmpty())) {
			throw new ApiException(ErrorCode.ACCOUNT_ENTRY_FROM_ORDER);
		}
		AuditChanges changes = new AuditChanges().add("Type", entry.getKind(), form.kind())
			.add("Catégorie", entry.getCategory(), form.category())
			.add("Date", entry.getOccurredOn(), form.occurredOn())
			.add("Libellé", entry.getLabel(), form.label())
			.add("Montant", entry.getAmount(), form.amount())
			.add("Admin", entry.getAdminEmail(), form.adminEmail());
		entry.setKind(form.kind());
		entry.setCategory(form.category());
		applyAmount(form, entry);
		apply(form, entry);
		// Money coming in has no receipt
		if (entry.getKind() == AccountKind.INCOME && entry.getReceiptImage() != null) {
			Image receipt = entry.getReceiptImage();
			entry.setReceiptImage(null);
			imageService.deleteReceipt(receipt);
		}
		AccountEntry saved = repository.saveAndFlush(entry);
		auditLog.record(AuditAction.UPDATED, AuditKind.ACCOUNT_ENTRY, saved.getLabel(), id, changes);
		return toResponse(saved, null, Map.of());
	}

	/** For good, with its receipt; a line coming from an order leaves with its order only. */
	@Transactional
	public void delete(long id) {
		AccountEntry entry = find(id);
		if (entry.getOrderId() != null) {
			throw new ApiException(ErrorCode.ACCOUNT_ENTRY_FROM_ORDER);
		}
		auditLog.record(AuditAction.DELETED, AuditKind.ACCOUNT_ENTRY, entry.getLabel(), null);
		Image receipt = entry.getReceiptImage();
		repository.delete(entry);
		if (receipt != null) {
			imageService.deleteReceipt(receipt);
		}
	}

	/** The photo of the receipt of an expense; the one it replaces goes for good. */
	@Transactional
	public AccountEntryResponse attachReceipt(long id, ProcessedImage processed) {
		AccountEntry entry = find(id);
		if (entry.getKind() != AccountKind.EXPENSE) {
			throw new ApiException(ErrorCode.ACCOUNT_RECEIPT_EXPENSE_ONLY);
		}
		Image previous = entry.getReceiptImage();
		entry.setReceiptImage(imageService.createReceipt(processed));
		AccountEntry saved = repository.saveAndFlush(entry);
		if (previous != null) {
			imageService.deleteReceipt(previous);
		}
		auditLog.record(AuditAction.UPDATED, AuditKind.ACCOUNT_ENTRY, saved.getLabel(), id,
				new AuditChanges().add("Ticket", previous != null, true));
		return toResponse(saved, null, Map.of());
	}

	@Transactional
	public AccountEntryResponse removeReceipt(long id) {
		AccountEntry entry = find(id);
		Image receipt = entry.getReceiptImage();
		if (receipt != null) {
			entry.setReceiptImage(null);
			repository.saveAndFlush(entry);
			imageService.deleteReceipt(receipt);
			auditLog.record(AuditAction.UPDATED, AuditKind.ACCOUNT_ENTRY, entry.getLabel(), id,
					new AuditChanges().add("Ticket", true, false));
		}
		return toResponse(entry, null, Map.of());
	}

	public ImageStorage.StoredFile openReceipt(long id) {
		Image receipt = find(id).getReceiptImage();
		if (receipt == null) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return imageService.openReceipt(receipt.getId());
	}

	/** An order handed over: its line, created dated today, or brought in line with the order. */
	@Transactional
	public void recordSale(long orderId, BigDecimal amount, String adminEmail) {
		if (amount.signum() == 0) {
			// Offered: no money came in
			dropSale(orderId);
			return;
		}
		AccountEntry entry = repository.findByOrderId(orderId).orElseGet(() -> {
			AccountEntry created = new AccountEntry();
			created.setOrderId(orderId);
			created.setKind(AccountKind.INCOME);
			created.setCategory(AccountCategory.SALE);
			created.setOccurredOn(LocalDate.now(PARIS));
			created.setLabel("Commande n° " + orderId);
			return created;
		});
		entry.setAmount(amount);
		entry.setAdminEmail(adminEmail);
		repository.save(entry);
	}

	/** The order went back a step, was offered or deleted. */
	@Transactional
	public void dropSale(long orderId) {
		repository.findByOrderId(orderId).ifPresent(repository::delete);
	}

	private static void apply(AccountEntryForm form, AccountEntry entry) {
		entry.setOccurredOn(form.occurredOn());
		entry.setLabel(form.label().strip());
		entry.setAdminEmail(form.adminEmail().strip());
	}

	/**
	 * Detailed, an expense amounts to what its purchases cost: only an expense for ingredients or
	 * packaging may be. A purchase of an ingredient of the site takes its name.
	 */
	private void applyAmount(AccountEntryForm form, AccountEntry entry) {
		List<PurchaseLineForm> purchases = purchases(form);
		if (entry.getOrderId() != null) {
			return;
		}
		if (purchases.isEmpty()) {
			entry.getPurchases().clear();
			entry.setAmount(form.amount());
			return;
		}
		if (form.kind() != AccountKind.EXPENSE
				|| (form.category() != AccountCategory.INGREDIENTS && form.category() != AccountCategory.PACKAGING)) {
			throw new ApiException(ErrorCode.ACCOUNT_PURCHASE_INVALID);
		}
		Map<Long, String> ingredients = ingredientRepository
			.findAllById(purchases.stream().map(PurchaseLineForm::ingredientId).filter(Objects::nonNull).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Ingredient::getId, Ingredient::getName));
		entry.getPurchases().clear();
		for (PurchaseLineForm line : purchases) {
			String ingredientName = line.ingredientId() == null ? null : ingredients.get(line.ingredientId());
			entry.getPurchases().add(new PurchaseLine(ingredientName != null ? ingredientName : line.item().strip(),
					ingredientName != null ? line.ingredientId() : null, line.quantity(), line.unit(), line.price()));
		}
		entry.setAmount(entry.getPurchases().stream().map(PurchaseLine::price).reduce(BigDecimal.ZERO, BigDecimal::add));
	}

	private static List<PurchaseLineForm> purchases(AccountEntryForm form) {
		return form.purchases() == null ? List.of() : form.purchases();
	}

	private List<AccountEntry> ofYear(int year) {
		return repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
	}

	private static boolean within(LocalDate date, LocalDate from, LocalDate to) {
		return !date.isBefore(from) && !date.isAfter(to);
	}

	/** The orders of the sales of these lines still kept (they are erased 12 months after being finished). */
	private Map<Long, ShopOrder> ordersOf(Collection<AccountEntry> entries) {
		List<Long> ids = entries.stream().map(AccountEntry::getOrderId).filter(Objects::nonNull).toList();
		return ids.isEmpty() ? Map.of()
				: orderRepository.findAllById(ids).stream().collect(Collectors.toMap(ShopOrder::getId, Function.identity()));
	}

	/**
	 * The orders handed over in the period: those paid have their line in the accounts; those offered
	 * have none, and count on the day they were handed over.
	 */
	private KeyFigures figures(List<AccountEntry> entries, LocalDate from, LocalDate to) {
		List<AccountEntry> sales = entries.stream().filter(entry -> entry.getOrderId() != null).toList();
		int offered = (int) orderRepository.findByStatus(OrderStatus.PICKED_UP).stream()
			.filter(order -> order.getAmount().signum() == 0)
			.filter(order -> within(order.getUpdatedAt().atZone(PARIS).toLocalDate(), from, to))
			.count();
		BigDecimal salesTotal = sales.stream().map(AccountEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
		AccountTotals totals = totals(entries);
		return new KeyFigures(sales.size() + offered, offered,
				sales.isEmpty() ? null : salesTotal.divide(BigDecimal.valueOf(sales.size()), 2, RoundingMode.HALF_UP),
				totals.income().signum() == 0 ? null : totals.balance().divide(totals.income(), 4, RoundingMode.HALF_UP));
	}

	private static List<CategoryTotal> expensesByCategory(List<AccountEntry> entries) {
		Map<AccountCategory, BigDecimal> sums = new EnumMap<>(AccountCategory.class);
		entries.stream()
			.filter(entry -> entry.getKind() == AccountKind.EXPENSE)
			.forEach(entry -> sums.merge(entry.getCategory(), entry.getAmount(), BigDecimal::add));
		return EXPENSE_CATEGORIES.stream().map(category -> new CategoryTotal(category, sums.getOrDefault(category, BigDecimal.ZERO))).toList();
	}

	/**
	 * By product, over the orders paid in the period: what each order brought is shared out between
	 * its lines (a discount lowers them all), then the cost price of what was sold is taken off.
	 */
	private static List<BestSeller> bestSellers(List<AccountEntry> entries, Map<Long, ShopOrder> orders,
			Map<Long, ProductCost> costs) {
		Map<String, BestSellerSum> sums = new LinkedHashMap<>();
		for (AccountEntry sale : entries) {
			ShopOrder order = sale.getOrderId() == null ? null : orders.get(sale.getOrderId());
			if (order == null || order.getLines().isEmpty()) {
				continue;
			}
			BigDecimal listed = order.getLines().stream().map(AccountingService::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
			for (ShopOrderLine line : order.getLines()) {
				BigDecimal revenue = listed.signum() == 0 ? BigDecimal.ZERO
						: lineTotal(line).multiply(sale.getAmount()).divide(listed, 2, RoundingMode.HALF_UP);
				String key = line.productId() != null ? "#" + line.productId() : CostPrices.key(line.title());
				BestSellerSum sum = sums.computeIfAbsent(key, ignored -> new BestSellerSum(line.productId(), line.title()));
				sum.quantity += line.quantity();
				sum.revenue = sum.revenue.add(revenue);
				ProductCost cost = line.productId() == null ? null : costs.get(line.productId());
				if (cost == null || !cost.complete()) {
					sum.costKnown = false;
				}
				else {
					sum.cost = sum.cost.add(cost.cost().multiply(BigDecimal.valueOf(line.quantity())));
				}
			}
		}
		return sums.values().stream()
			.map(sum -> new BestSeller(sum.productId, sum.name, sum.quantity, sum.revenue,
					sum.costKnown ? sum.revenue.subtract(sum.cost) : null))
			.sorted(Comparator.comparing(BestSeller::revenue).reversed().thenComparing(BestSeller::name))
			.limit(BEST_SELLERS)
			.toList();
	}

	private static final class BestSellerSum {

		private final @Nullable Long productId;

		private final String name;

		private int quantity;

		private BigDecimal revenue = BigDecimal.ZERO;

		private BigDecimal cost = BigDecimal.ZERO;

		private boolean costKnown = true;

		private BestSellerSum(@Nullable Long productId, String name) {
			this.productId = productId;
			this.name = name;
		}

	}

	private static BigDecimal lineTotal(ShopOrderLine line) {
		return line.unitPrice().multiply(BigDecimal.valueOf(line.quantity()));
	}

	private static void checkCategory(AccountKind kind, AccountCategory category) {
		if (category == AccountCategory.SALE && kind != AccountKind.INCOME) {
			throw new ApiException(ErrorCode.ACCOUNT_CATEGORY_INVALID);
		}
	}

	/** One of the admins; or the one already on the line, who may have left. */
	private void checkAdmin(String email, @Nullable String current) {
		if (!email.strip().equals(current) && !adminProperties.isAdmin(email)) {
			throw new ApiException(ErrorCode.SHOP_ADMIN_UNKNOWN);
		}
	}

	private AccountEntry find(long id) {
		return repository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.ACCOUNT_ENTRY_NOT_FOUND));
	}

	static AccountTotals totals(Collection<AccountEntry> entries) {
		BigDecimal income = sum(entries, AccountKind.INCOME);
		BigDecimal expense = sum(entries, AccountKind.EXPENSE);
		return new AccountTotals(income, expense, income.subtract(expense));
	}

	private static BigDecimal sum(Collection<AccountEntry> entries, AccountKind kind) {
		return entries.stream()
			.filter(entry -> entry.getKind() == kind)
			.map(AccountEntry::getAmount)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static String categoryLabel(AccountCategory category) {
		return switch (category) {
			case SALE -> "Vente";
			case INGREDIENTS -> "Ingrédients";
			case PACKAGING -> "Emballages";
			case EQUIPMENT -> "Matériel";
			case OTHER -> "Autre";
		};
	}

	/** Quoted when needed; a label read as a formula by a spreadsheet is written as text. */
	static String csvText(String text) {
		String safe = text.matches("^[=+\\-@\\t\\r].*") ? "'" + text : text;
		return safe.contains(";") || safe.contains("\"") || safe.contains("\n")
				? "\"" + safe.replace("\"", "\"\"") + "\""
				: safe;
	}

	/** "2 × Boîte de 6 cookies, 1 × Tarte citron". */
	private static String summary(ShopOrder order) {
		return order.getLines().stream().map(line -> line.quantity() + " × " + line.title()).collect(Collectors.joining(", "));
	}

	/** What the order brought less the cost price of what it held: unknown if one of its products has no cost. */
	private static @Nullable BigDecimal margin(AccountEntry sale, ShopOrder order, Map<Long, ProductCost> costs) {
		if (order.getLines().isEmpty()) {
			return null;
		}
		BigDecimal cost = BigDecimal.ZERO;
		for (ShopOrderLine line : order.getLines()) {
			ProductCost productCost = line.productId() == null ? null : costs.get(line.productId());
			if (productCost == null || !productCost.complete()) {
				return null;
			}
			cost = cost.add(productCost.cost().multiply(BigDecimal.valueOf(line.quantity())));
		}
		return sale.getAmount().subtract(cost);
	}

	private static AccountEntryResponse toResponse(AccountEntry entry, @Nullable ShopOrder order, Map<Long, ProductCost> costs) {
		List<PurchaseLineResponse> purchases = new ArrayList<>();
		for (PurchaseLine line : entry.getPurchases()) {
			BigDecimal perBase = CostPrices.perBase(line.quantity(), line.unit(), line.price());
			purchases.add(new PurchaseLineResponse(line.item(), line.ingredientId(), line.quantity(), line.unit(), line.price(),
					CostPrices.perUnit(perBase, line.unit().measure()), CostPrices.priceUnit(line.unit().measure())));
		}
		return new AccountEntryResponse(entry.getId(), entry.getKind(), entry.getCategory(), entry.getOccurredOn(), entry.getLabel(),
				entry.getAmount(), entry.getAdminEmail(), entry.getOrderId(), purchases, entry.getReceiptImage() != null,
				order == null || order.getLines().isEmpty() ? null : summary(order), order == null ? null : margin(entry, order, costs));
	}

}
