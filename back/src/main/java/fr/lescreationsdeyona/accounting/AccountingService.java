package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountTotals;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountingOverview;
import fr.lescreationsdeyona.accounting.AccountingResponses.AdminTotals;
import fr.lescreationsdeyona.accounting.AccountingResponses.MonthTotals;
import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AdminProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The accounts of the shop: the orders handed over come in by themselves, the rest is typed by the
 * admins, and each line is counted for one of them. Kept for good, backed up with the site: the
 * lines hold nothing about the customers.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountingService {

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private static final DateTimeFormatter CSV_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private final AccountEntryRepository repository;

	private final AdminProperties adminProperties;

	private final AuditLog auditLog;

	public AccountingOverview overview(int year) {
		List<AccountEntry> entries = ofYear(year);
		TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
		years.addAll(repository.findYears());
		years.add(year);
		years.add(LocalDate.now(PARIS).getYear());
		TreeSet<String> admins = new TreeSet<>(adminProperties.emails());
		entries.forEach(entry -> admins.add(entry.getAdminEmail()));
		Map<Integer, List<AccountEntry>> byMonth = entries.stream()
			.collect(Collectors.groupingBy(entry -> entry.getOccurredOn().getMonthValue(), TreeMap::new, Collectors.toList()));
		Map<String, List<AccountEntry>> byAdmin = entries.stream()
			.collect(Collectors.groupingBy(AccountEntry::getAdminEmail, TreeMap::new, Collectors.toList()));
		return new AccountingOverview(year, List.copyOf(years), List.copyOf(admins), totals(entries),
				byMonth.entrySet().stream().map(month -> new MonthTotals(month.getKey(), totals(month.getValue()))).toList(),
				byAdmin.entrySet().stream().map(admin -> new AdminTotals(admin.getKey(), totals(admin.getValue()))).toList(),
				entries.stream().map(AccountingService::toResponse).toList());
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
		entry.setAmount(form.amount());
		apply(form, entry);
		AccountEntry saved = repository.saveAndFlush(entry);
		auditLog.record(AuditAction.CREATED, AuditKind.ACCOUNT_ENTRY, saved.getLabel(), saved.getId());
		return toResponse(saved);
	}

	/** A line coming from an order keeps its kind, category and amount: those follow the order. */
	@Transactional
	public AccountEntryResponse update(long id, AccountEntryForm form) {
		AccountEntry entry = find(id);
		checkCategory(form.kind(), form.category());
		checkAdmin(form.adminEmail(), entry.getAdminEmail());
		if (entry.getOrderId() != null && (entry.getKind() != form.kind() || entry.getCategory() != form.category()
				|| entry.getAmount().compareTo(form.amount()) != 0)) {
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
		entry.setAmount(form.amount());
		apply(form, entry);
		AccountEntry saved = repository.saveAndFlush(entry);
		auditLog.record(AuditAction.UPDATED, AuditKind.ACCOUNT_ENTRY, saved.getLabel(), id, changes);
		return toResponse(saved);
	}

	/** For good; a line coming from an order leaves with its order only. */
	@Transactional
	public void delete(long id) {
		AccountEntry entry = find(id);
		if (entry.getOrderId() != null) {
			throw new ApiException(ErrorCode.ACCOUNT_ENTRY_FROM_ORDER);
		}
		auditLog.record(AuditAction.DELETED, AuditKind.ACCOUNT_ENTRY, entry.getLabel(), null);
		repository.delete(entry);
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

	private List<AccountEntry> ofYear(int year) {
		return repository.findByOccurredOnBetweenOrderByOccurredOnDescIdDesc(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
	}

	private static void checkCategory(AccountKind kind, AccountCategory category) {
		if (category == AccountCategory.SALE && kind != AccountKind.INCOME) {
			throw new ApiException(ErrorCode.ACCOUNT_CATEGORY_INVALID);
		}
	}

	/** One of the admins; or the one already on the line, who may have left. */
	private void checkAdmin(String email, String current) {
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

	private static AccountEntryResponse toResponse(AccountEntry entry) {
		return new AccountEntryResponse(entry.getId(), entry.getKind(), entry.getCategory(), entry.getOccurredOn(), entry.getLabel(),
				entry.getAmount(), entry.getAdminEmail(), entry.getOrderId());
	}

}
