package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.shop.ShopForms.ShopProductForm;
import fr.lescreationsdeyona.shop.ShopForms.ShopSettingsForm;
import fr.lescreationsdeyona.shop.ShopResponses.AdminShopProduct;
import fr.lescreationsdeyona.shop.ShopResponses.ShopPage;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ShopServiceTest {

	private final ShopSettingsRepository settingsRepository = mock(ShopSettingsRepository.class);

	private final ShopProductRepository products = mock(ShopProductRepository.class);

	private final RecipeRepository recipes = mock(RecipeRepository.class);

	private final CategoryRepository categories = mock(CategoryRepository.class);

	private final ShopService service = new ShopService(settingsRepository, products, recipes, categories, mock(ImageService.class),
			mock(AuditLog.class));

	private final ShopSettings settings = new ShopSettings();

	private final Category desserts = category(1L, "desserts", "Desserts");

	private static Category category(long id, String slug, String name) {
		Category category = new Category();
		category.setId(id);
		category.setSlug(slug);
		category.setName(name);
		return category;
	}

	@BeforeEach
	void setUp() {
		settings.setMode(ShopMode.FRIENDS);
		when(settingsRepository.findById(ShopSettings.ID)).thenReturn(Optional.of(settings));
		when(settingsRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
		when(products.saveAndFlush(any())).thenAnswer(invocation -> {
			ShopProduct product = invocation.getArgument(0);
			product.setId(3L);
			return product;
		});
		Recipe recipe = new Recipe();
		recipe.setId(4L);
		recipe.setTitle("Cookies");
		recipe.setStatus(RecipeStatus.PUBLISHED);
		recipe.getCategories().add(desserts);
		when(recipes.findById(4L)).thenReturn(Optional.of(recipe));
		when(categories.findById(2L)).thenReturn(Optional.of(category(2L, "cadeaux", "Cadeaux")));
	}

	private static ShopProductForm form(Long recipeId, Long categoryId, Integer batchSize) {
		return new ShopProductForm(recipeId, " boîte de 6 cookies ", null, categoryId, new BigDecimal("12.00"), " ", batchSize, null, " ",
				null, true);
	}

	@Test
	void showsNoProductWhileClosed() {
		settings.setMode(ShopMode.CLOSED);

		ShopPage page = service.page();

		assertThat(page.open()).isFalse();
		assertThat(page.products()).isEmpty();
		verify(products, never()).findOnSale();
	}

	@Test
	void showsTheProductsToTheCloseOnes() {
		ShopProduct product = new ShopProduct();
		product.setId(1L);
		product.setName("Coffret");
		product.setPrice(new BigDecimal("20.00"));
		product.setCategory(desserts);
		when(products.findOnSale()).thenReturn(List.of(product));

		ShopPage page = service.page();

		assertThat(page.mode()).isEqualTo(ShopMode.FRIENDS);
		assertThat(page.open()).isTrue();
		assertThat(page.products()).hasSize(1);
		assertThat(page.products().getFirst().format()).isEqualTo("À l'unité");
		assertThat(page.products().getFirst().categories()).extracting(ShopResponses.ShopCategory::slug).containsExactly("desserts");
	}

	@Test
	void takesItsRecipesCategoriesAndDefaults() {
		AdminShopProduct product = service.createProduct(form(4L, 2L, 6));

		assertThat(product.name()).isEqualTo("Boîte de 6 cookies");
		assertThat(product.recipeTitle()).isEqualTo("Cookies");
		// With a recipe, the category typed is not kept: the recipe's are
		assertThat(product.categoryId()).isNull();
		assertThat(product.categoryNames()).containsExactly("Desserts");
		assertThat(product.format()).isEqualTo("Boîte de 6");
		assertThat(product.unitPrice()).isEqualByComparingTo("2.00");
		assertThat(product.recipeShare()).isEqualByComparingTo("1");
		assertThat(product.packagingCount()).isEqualTo(1);
		assertThat(product.packaging()).isNull();
		assertThat(product.portionLabel()).isNull();
		assertThat(product.onSale()).isTrue();
	}

	@Test
	void givesAProductWithoutRecipeItsOwnCategory() {
		AdminShopProduct product = service.createProduct(form(null, 2L, null));

		assertThat(product.recipeId()).isNull();
		assertThat(product.categoryId()).isEqualTo(2L);
		assertThat(product.categoryNames()).containsExactly("Cadeaux");
		assertThat(product.format()).isEqualTo("À l'unité");
	}

	@Test
	void refusesAnUnknownRecipeOrCategory() {
		assertThatThrownBy(() -> service.createProduct(form(99L, null, null))).extracting("code").isEqualTo(ErrorCode.RECIPE_NOT_FOUND);
		assertThatThrownBy(() -> service.createProduct(form(null, 99L, null))).extracting("code").isEqualTo(ErrorCode.CATEGORY_NOT_FOUND);
	}

	@Test
	void refusesAnUnknownProduct() {
		assertThatThrownBy(() -> service.updateProduct(99, form(4L, null, null))).extracting("code")
			.isEqualTo(ErrorCode.SHOP_PRODUCT_NOT_FOUND);
		assertThatThrownBy(() -> service.deleteProduct(99)).extracting("code").isEqualTo(ErrorCode.SHOP_PRODUCT_NOT_FOUND);
	}

	@Test
	void changesThePositionOfTheShop() {
		service.updateSettings(new ShopSettingsForm(ShopMode.OPEN, "  Le samedi matin  "));

		assertThat(settings.getMode()).isEqualTo(ShopMode.OPEN);
		assertThat(settings.getPickupInfo()).isEqualTo("Le samedi matin");
		assertThat(service.adminSettings().mode()).isEqualTo(ShopMode.OPEN);
	}

	@Test
	void takesOrdersForTheCloseOnesAndForAll() {
		assertThat(ShopMode.CLOSED.takesOrders()).isFalse();
		assertThat(ShopMode.FRIENDS.takesOrders()).isTrue();
		assertThat(ShopMode.OPEN.takesOrders()).isTrue();
	}

}
