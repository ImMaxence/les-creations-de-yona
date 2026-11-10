package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.shop.ShopForms.ShopProductForm;
import fr.lescreationsdeyona.shop.ShopForms.ShopSettingsForm;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopProduct;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopSettings;
import fr.lescreationsdeyona.shop.ShopResponses.ShopCategory;
import fr.lescreationsdeyona.shop.ShopResponses.ShopPage;
import fr.lescreationsdeyona.shop.ShopResponses.ShopProductCard;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** The shop's window: its settings and the products it offers. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopService {

	private final ShopSettingsRepository settingsRepository;

	private final ShopProductRepository productRepository;

	private final RecipeRepository recipeRepository;

	private final CategoryRepository categoryRepository;

	private final ImageService imageService;

	private final AuditLog auditLog;

	@Cacheable(PublicCache.SHOP)
	public ShopPage page() {
		ShopSettings settings = settings();
		boolean open = settings.getMode().takesOrders();
		return new ShopPage(settings.getMode(), open, settings.getPickupInfo(),
				open ? productRepository.findOnSale().stream().map(ShopService::toCard).toList() : List.of());
	}

	public AdminShopSettings adminSettings() {
		return toAdmin(settings());
	}

	@Transactional
	public AdminShopSettings updateSettings(ShopSettingsForm form) {
		ShopSettings settings = settings();
		AuditChanges changes = new AuditChanges().add("Boutique", mode(settings.getMode()), mode(form.mode()))
			.add("Retrait", settings.getPickupInfo(), form.pickupInfo());
		settings.setMode(form.mode());
		settings.setPickupInfo(blankToNull(form.pickupInfo()));
		ShopSettings saved = settingsRepository.saveAndFlush(settings);
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_SETTINGS, "Réglages de la boutique", null, changes);
		return toAdmin(saved);
	}

	public List<AdminShopProduct> adminProducts() {
		return productRepository.findAllByName().stream().map(ShopService::toAdmin).toList();
	}

	@Transactional
	public AdminShopProduct createProduct(ShopProductForm form) {
		ShopProduct product = new ShopProduct();
		apply(form, product);
		ShopProduct saved = productRepository.saveAndFlush(product);
		auditLog.record(AuditAction.CREATED, AuditKind.SHOP_PRODUCT, saved.getName(), saved.getId());
		return toAdmin(saved);
	}

	@Transactional
	public AdminShopProduct updateProduct(long id, ShopProductForm form) {
		ShopProduct product = find(id);
		String nameBefore = product.getName();
		String recipeBefore = product.getRecipe() == null ? null : product.getRecipe().getTitle();
		BigDecimal priceBefore = product.getPrice();
		String formatBefore = product.formatLabel();
		boolean availableBefore = product.isAvailable();
		apply(form, product);
		ShopProduct saved = productRepository.saveAndFlush(product);
		AuditChanges changes = new AuditChanges().add("Nom", nameBefore, saved.getName())
			.add("Recette", recipeBefore, saved.getRecipe() == null ? null : saved.getRecipe().getTitle())
			.add("Prix", priceBefore, saved.getPrice())
			.add("Format", formatBefore, saved.formatLabel())
			.add("Disponible", availableBefore, saved.isAvailable());
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_PRODUCT, saved.getName(), id, changes);
		return toAdmin(saved);
	}

	/** Out of the shop, for good; its recipe stays on the blog and past orders keep their lines. */
	@Transactional
	public void deleteProduct(long id) {
		ShopProduct product = find(id);
		auditLog.record(AuditAction.DELETED, AuditKind.SHOP_PRODUCT, product.getName(), null);
		productRepository.delete(product);
	}

	private void apply(ShopProductForm form, ShopProduct product) {
		Recipe recipe = form.recipeId() == null ? null
				: recipeRepository.findById(form.recipeId()).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
		Image image = form.imageId() == null ? null : imageService.getLandscape(form.imageId());
		// With a recipe, its categories; without, its own
		Category category = recipe != null || form.categoryId() == null ? null
				: categoryRepository.findById(form.categoryId()).orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
		product.setRecipe(recipe);
		product.setName(Texts.capitalizeFirstLetter(form.name().strip()));
		product.setImage(image);
		product.setCategory(category);
		product.setPrice(form.price());
		product.setPortionLabel(blankToNull(form.portionLabel()));
		product.setBatchSize(form.batchSize());
		product.setRecipeShare(form.recipeShare() == null ? BigDecimal.ONE : form.recipeShare());
		product.setPackaging(blankToNull(form.packaging()));
		product.setPackagingCount(form.packagingCount() == null ? 1 : form.packagingCount());
		product.setAvailable(form.available());
	}

	private ShopSettings settings() {
		return settingsRepository.findById(ShopSettings.ID).orElseThrow();
	}

	private ShopProduct find(long id) {
		return productRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.SHOP_PRODUCT_NOT_FOUND));
	}

	private static @Nullable String blankToNull(@Nullable String text) {
		return StringUtils.hasText(text) ? text.strip() : null;
	}

	private static String mode(ShopMode mode) {
		return switch (mode) {
			case CLOSED -> "Fermée";
			case FRIENDS -> "Proches";
			case OPEN -> "Ouverte";
		};
	}

	private static ShopProductCard toCard(ShopProduct product) {
		Image image = product.shownImage();
		return new ShopProductCard(product.getId(), product.getName(), image == null ? null : image.getId(), product.getPrice(),
				product.format(), product.getPortionLabel(), product.getBatchSize(), product.unitPrice(),
				product.categories().stream().map(category -> new ShopCategory(category.getSlug(), category.getName())).toList());
	}

	private static AdminShopProduct toAdmin(ShopProduct product) {
		Recipe recipe = product.getRecipe();
		Image shown = product.shownImage();
		return new AdminShopProduct(product.getId(), recipe == null ? null : recipe.getId(), recipe == null ? null : recipe.getTitle(),
				recipe == null ? null : recipe.getStatus(), product.getName(),
				product.getImage() == null ? null : product.getImage().getId(), shown == null ? null : shown.getId(),
				product.getCategory() == null ? null : product.getCategory().getId(),
				product.categories().stream().map(Category::getName).toList(), product.getPrice(), product.format(),
				product.getPortionLabel(), product.getBatchSize(), product.unitPrice(), product.getRecipeShare(),
				product.getPackaging(), product.getPackagingCount(), product.isAvailable(), product.onSale(),
				product.getUpdatedAt());
	}

	private static AdminShopSettings toAdmin(ShopSettings settings) {
		return new AdminShopSettings(settings.getMode(), settings.getPickupInfo(), settings.getUpdatedAt());
	}

}
