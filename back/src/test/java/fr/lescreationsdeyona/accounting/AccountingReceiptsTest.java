package fr.lescreationsdeyona.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.accounting.AccountEntryForm.PurchaseLineForm;
import fr.lescreationsdeyona.accounting.AccountingResponses.AccountEntryResponse;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.security.AdminProperties;
import fr.lescreationsdeyona.shop.ShopOrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

/** The photos of the receipts, and the expenses detailed purchase by purchase. */
class AccountingReceiptsTest {

	private final AccountEntryRepository repository = mock(AccountEntryRepository.class);

	private final IngredientRepository ingredients = mock(IngredientRepository.class);

	private final ImageService images = mock(ImageService.class);

	private final AccountingService service = new AccountingService(repository, new AdminProperties(Set.of("yona@example.fr")),
			mock(AuditLog.class), mock(ShopOrderRepository.class), ingredients, mock(CostPriceService.class), images);

	private final ProcessedImage photo = new ProcessedImage(List.of());

	@BeforeEach
	void savesAsGiven() {
		when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	private AccountEntry existing(AccountKind kind) {
		AccountEntry entry = new AccountEntry();
		entry.setId(3L);
		entry.setKind(kind);
		entry.setCategory(kind == AccountKind.INCOME ? AccountCategory.SALE : AccountCategory.INGREDIENTS);
		entry.setOccurredOn(LocalDate.parse("2026-11-03"));
		entry.setLabel("Courses");
		entry.setAmount(new BigDecimal("9.80"));
		entry.setAdminEmail("yona@example.fr");
		when(repository.findById(3L)).thenReturn(Optional.of(entry));
		return entry;
	}

	private static Image receipt() {
		Image image = mock(Image.class);
		UUID id = UUID.randomUUID();
		when(image.getId()).thenReturn(id);
		when(image.getKind()).thenReturn(ImageKind.RECEIPT);
		return image;
	}

	private static AccountEntryForm form(AccountKind kind, AccountCategory category, List<PurchaseLineForm> purchases) {
		return new AccountEntryForm(kind, category, LocalDate.parse("2026-11-03"), "Courses", new BigDecimal("1.00"), "yona@example.fr",
				purchases);
	}

	private static PurchaseLineForm purchase(Long ingredientId, String item, String quantity, PurchaseUnit unit, String price) {
		return new PurchaseLineForm(ingredientId, item, new BigDecimal(quantity), unit, new BigDecimal(price));
	}

	@Test
	void attachesTheReceiptOfAnExpense() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image created = receipt();
		when(images.createReceipt(photo)).thenReturn(created);

		AccountEntryResponse response = service.attachReceipt(3, photo);

		assertThat(response.receipt()).isTrue();
		assertThat(entry.getReceiptImage()).isSameAs(created);
		verify(images, never()).deleteReceipt(any());
	}

	@Test
	void replacesTheReceiptOnceTheNewOneIsSaved() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image previous = receipt();
		entry.setReceiptImage(previous);
		Image next = receipt();
		when(images.createReceipt(photo)).thenReturn(next);

		service.attachReceipt(3, photo);

		InOrder order = inOrder(repository, images);
		order.verify(repository).saveAndFlush(entry);
		order.verify(images).deleteReceipt(previous);
	}

	@Test
	void givesMoneyComingInNoReceipt() {
		existing(AccountKind.INCOME);

		assertThatThrownBy(() -> service.attachReceipt(3, photo)).extracting("code").isEqualTo(ErrorCode.ACCOUNT_RECEIPT_EXPENSE_ONLY);
		verify(images, never()).createReceipt(any());
	}

	@Test
	void removesTheReceiptForGood() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image previous = receipt();
		entry.setReceiptImage(previous);

		assertThat(service.removeReceipt(3).receipt()).isFalse();
		verify(images).deleteReceipt(previous);
	}

	@Test
	void hasNothingToRemoveWithoutReceipt() {
		existing(AccountKind.EXPENSE);

		assertThat(service.removeReceipt(3).receipt()).isFalse();
		verify(images, never()).deleteReceipt(any());
	}

	@Test
	void showsTheReceiptToTheAdminsOnly() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		assertThatThrownBy(() -> service.openReceipt(3)).extracting("code").isEqualTo(ErrorCode.IMAGE_NOT_FOUND);

		Image attached = receipt();
		entry.setReceiptImage(attached);
		service.openReceipt(3);

		verify(images).openReceipt(attached.getId());
	}

	@Test
	void refusesTheReceiptOfAnUnknownLine() {
		assertThatThrownBy(() -> service.attachReceipt(99, photo)).extracting("code").isEqualTo(ErrorCode.ACCOUNT_ENTRY_NOT_FOUND);
		assertThatThrownBy(() -> service.openReceipt(99)).extracting("code").isEqualTo(ErrorCode.ACCOUNT_ENTRY_NOT_FOUND);
	}

	@Test
	void deletesTheReceiptWithItsLine() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image attached = receipt();
		entry.setReceiptImage(attached);

		service.delete(3);

		verify(repository).delete(entry);
		verify(images).deleteReceipt(attached);
	}

	@Test
	void dropsTheReceiptOfALineTurnedIntoMoneyComingIn() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image attached = receipt();
		entry.setReceiptImage(attached);

		service.update(3, form(AccountKind.INCOME, AccountCategory.OTHER, null));

		assertThat(entry.getReceiptImage()).isNull();
		verify(images).deleteReceipt(attached);
	}

	@Test
	void keepsTheReceiptOfAnExpenseChanged() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		Image attached = receipt();
		entry.setReceiptImage(attached);

		service.update(3, form(AccountKind.EXPENSE, AccountCategory.EQUIPMENT, null));

		assertThat(entry.getReceiptImage()).isSameAs(attached);
		verify(images, never()).deleteReceipt(any());
	}

	@Test
	void namesAPurchaseAfterTheIngredientOfTheSite() {
		Ingredient butter = new Ingredient();
		butter.setId(46L);
		butter.setName("Beurre doux");
		when(ingredients.findAllById(any())).thenReturn(List.of(butter));

		AccountEntryResponse response = service.create(form(AccountKind.EXPENSE, AccountCategory.INGREDIENTS,
				List.of(purchase(46L, "beurre", "1", PurchaseUnit.KG, "9.80"), purchase(99L, " Sucre ", "1", PurchaseUnit.KG, "1.20"))));

		// An ingredient no longer on the site keeps the name typed, without its id
		assertThat(response.purchases()).extracting(line -> line.item() + "/" + line.ingredientId())
			.containsExactly("Beurre doux/46", "Sucre/null");
		assertThat(response.amount()).isEqualByComparingTo("11.00");
	}

	@Test
	void detailsNeitherMoneyComingInNorEquipment() {
		List<PurchaseLineForm> purchases = List.of(purchase(null, "Boîte kraft", "20", PurchaseUnit.PIECE, "12.00"));

		assertThatThrownBy(() -> service.create(form(AccountKind.INCOME, AccountCategory.OTHER, purchases))).extracting("code")
			.isEqualTo(ErrorCode.ACCOUNT_PURCHASE_INVALID);
		assertThatThrownBy(() -> service.create(form(AccountKind.EXPENSE, AccountCategory.EQUIPMENT, purchases))).extracting("code")
			.isEqualTo(ErrorCode.ACCOUNT_PURCHASE_INVALID);
		assertThat(service.create(form(AccountKind.EXPENSE, AccountCategory.PACKAGING, purchases)).amount()).isEqualByComparingTo("12.00");
	}

	@Test
	void forgetsTheDetailOfALineNoLongerDetailed() {
		AccountEntry entry = existing(AccountKind.EXPENSE);
		entry.getPurchases().add(new PurchaseLine("Beurre", null, BigDecimal.ONE, PurchaseUnit.KG, new BigDecimal("9.80")));

		AccountEntryResponse response = service.update(3, form(AccountKind.EXPENSE, AccountCategory.INGREDIENTS, List.of()));

		assertThat(response.purchases()).isEmpty();
		assertThat(response.amount()).isEqualByComparingTo("1.00");
	}

}
