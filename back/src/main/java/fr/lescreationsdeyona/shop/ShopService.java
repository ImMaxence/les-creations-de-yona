package fr.lescreationsdeyona.shop;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.shop.ShopForms.ShopProductForm;
import fr.lescreationsdeyona.shop.ShopForms.ShopSettingsForm;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopProduct;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopSettings;
import fr.lescreationsdeyona.shop.ShopResponses.ShopPage;
import fr.lescreationsdeyona.shop.ShopResponses.ShopProductCard;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** The shop's window: its settings and the recipes it offers. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopService {

	private final ShopSettingsRepository settingsRepository;

	private final ShopProductRepository productRepository;

	private final RecipeRepository recipeRepository;

	private final AuditLog auditLog;

	@Cacheable(PublicCache.SHOP)
	public ShopPage page() {
		ShopSettings settings = settings();
		return new ShopPage(settings.isOrdersOpen(), settings.getIntro(), settings.getPickupInfo(),
				settings.isOrdersOpen() ? productRepository.findOnSale().stream().map(ShopService::toCard).toList() : List.of());
	}

	public AdminShopSettings adminSettings() {
		return toAdmin(settings());
	}

	@Transactional
	public AdminShopSettings updateSettings(ShopSettingsForm form) {
		ShopSettings settings = settings();
		AuditChanges changes = new AuditChanges().add("Boutique ouverte", settings.isOrdersOpen(), form.ordersOpen())
			.add("Présentation", settings.getIntro(), form.intro())
			.add("Retrait", settings.getPickupInfo(), form.pickupInfo());
		settings.setOrdersOpen(form.ordersOpen());
		settings.setIntro(form.intro().strip());
		settings.setPickupInfo(blankToNull(form.pickupInfo()));
		ShopSettings saved = settingsRepository.saveAndFlush(settings);
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_SETTINGS, "Réglages de la boutique", null, changes);
		return toAdmin(saved);
	}

	public List<AdminShopProduct> adminProducts() {
		return productRepository.findAllByTitle().stream().map(ShopService::toAdmin).toList();
	}

	@Transactional
	public AdminShopProduct createProduct(ShopProductForm form) {
		if (productRepository.existsByRecipeId(form.recipeId())) {
			throw new ApiException(ErrorCode.SHOP_PRODUCT_ALREADY_EXISTS);
		}
		Recipe recipe = recipeRepository.findById(form.recipeId()).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
		ShopProduct product = new ShopProduct();
		product.setRecipe(recipe);
		apply(form, product);
		ShopProduct saved = productRepository.saveAndFlush(product);
		auditLog.record(AuditAction.CREATED, AuditKind.SHOP_PRODUCT, recipe.getTitle(), saved.getId());
		return toAdmin(saved);
	}

	/** Its recipe does not change: a different recipe is another product. */
	@Transactional
	public AdminShopProduct updateProduct(long id, ShopProductForm form) {
		ShopProduct product = find(id);
		AuditChanges changes = new AuditChanges().add("Prix", product.getPrice(), form.price())
			.add("Portions", product.getPortionLabel(), form.portionLabel())
			.add("Disponible", product.isAvailable(), form.available());
		apply(form, product);
		ShopProduct saved = productRepository.saveAndFlush(product);
		auditLog.record(AuditAction.UPDATED, AuditKind.SHOP_PRODUCT, saved.getRecipe().getTitle(), id, changes);
		return toAdmin(saved);
	}

	/** Out of the shop, for good; the recipe stays on the blog and past orders keep their lines. */
	@Transactional
	public void deleteProduct(long id) {
		ShopProduct product = find(id);
		auditLog.record(AuditAction.DELETED, AuditKind.SHOP_PRODUCT, product.getRecipe().getTitle(), null);
		productRepository.delete(product);
	}

	private static void apply(ShopProductForm form, ShopProduct product) {
		product.setPrice(form.price());
		product.setPortionLabel(blankToNull(form.portionLabel()));
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

	private static ShopProductCard toCard(ShopProduct product) {
		Recipe recipe = product.getRecipe();
		return new ShopProductCard(product.getId(), recipe.getTitle(), recipe.getSlug(), recipe.getMainCategory().getSlug(),
				recipe.getIntro(), recipe.getImage() == null ? null : recipe.getImage().getId(), product.getPrice(),
				product.getPortionLabel());
	}

	private static AdminShopProduct toAdmin(ShopProduct product) {
		Recipe recipe = product.getRecipe();
		return new AdminShopProduct(product.getId(), recipe.getId(), recipe.getTitle(), recipe.getStatus(),
				recipe.getImage() == null ? null : recipe.getImage().getId(), product.getPrice(), product.getPortionLabel(),
				product.isAvailable(), product.getUpdatedAt());
	}

	private static AdminShopSettings toAdmin(ShopSettings settings) {
		return new AdminShopSettings(settings.isOrdersOpen(), settings.getIntro(), settings.getPickupInfo(), settings.getUpdatedAt());
	}

}
