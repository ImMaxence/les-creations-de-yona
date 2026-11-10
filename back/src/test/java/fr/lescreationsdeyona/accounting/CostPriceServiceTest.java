package fr.lescreationsdeyona.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.accounting.AccountEntryRepository.PurchaseRow;
import fr.lescreationsdeyona.accounting.AccountingResponses.CostLine;
import fr.lescreationsdeyona.accounting.AccountingResponses.LastPrice;
import fr.lescreationsdeyona.accounting.AccountingResponses.ProductCost;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientPiece;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeDetail;
import fr.lescreationsdeyona.recipe.RecipeDetail.IngredientLine;
import fr.lescreationsdeyona.recipe.RecipeService;
import fr.lescreationsdeyona.shop.ShopProduct;
import fr.lescreationsdeyona.shop.ShopProductRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CostPriceServiceTest {

	private final AccountEntryRepository entries = mock(AccountEntryRepository.class);

	private final ShopProductRepository products = mock(ShopProductRepository.class);

	private final IngredientRepository ingredients = mock(IngredientRepository.class);

	private final RecipeService recipes = mock(RecipeService.class);

	private final CostPriceService service = new CostPriceService(entries, products, ingredients, recipes);

	private static PurchaseRow row(String item, Long ingredientId, String quantity, PurchaseUnit unit, String price, String date) {
		return new PurchaseRow(item, ingredientId, new BigDecimal(quantity), unit, new BigDecimal(price), LocalDate.parse(date));
	}

	private static Ingredient ingredient(long id, String name) {
		Ingredient ingredient = new Ingredient();
		ingredient.setId(id);
		ingredient.setName(name);
		return ingredient;
	}

	private static IngredientLine line(String name, String quantity, String unit) {
		return new IngredientLine(name, quantity == null ? null : new BigDecimal(quantity), unit, null);
	}

	private static ShopProduct product(String price, String share, String packaging) {
		Recipe recipe = new Recipe();
		recipe.setId(4L);
		recipe.setTitle("Cookies");
		ShopProduct product = new ShopProduct();
		product.setId(1L);
		product.setName("Boîte de 6 cookies");
		product.setRecipe(recipe);
		product.setPrice(new BigDecimal(price));
		product.setBatchSize(6);
		product.setRecipeShare(new BigDecimal(share));
		product.setPackaging(packaging);
		product.setPackagingCount(1);
		return product;
	}

	@BeforeEach
	void setUp() {
		when(entries.findPurchasesLatestFirst()).thenReturn(List.of(
				row("Beurre", 46L, "1", PurchaseUnit.KG, "9.80", "2026-11-03"),
				row("Œufs", null, "6", PurchaseUnit.PIECE, "1.80", "2026-11-01"),
				row("Boîte kraft", null, "20", PurchaseUnit.PIECE, "12.00", "2026-10-20"),
				// Older: the last price paid is the one above
				row("Beurre doux", 46L, "1", PurchaseUnit.KG, "8.00", "2026-09-01")));
		when(ingredients.findAllById(anyCollection())).thenReturn(List.of(ingredient(46, "Beurre doux")));
		RecipeDetail recipe = mock(RecipeDetail.class);
		when(recipe.parts()).thenReturn(List.of(new RecipeDetail.Part(null, List.of(line("Beurre doux", "250", "g"),
				new IngredientLine("Oeufs", new BigDecimal("2"), null, null, new IngredientPiece(new BigDecimal("50"), "œuf", "œufs")),
				line("Sel", null, null), line("Vanille", "1", "gousse")), List.of())));
		when(recipes.getUnfolded(4L)).thenReturn(recipe);
	}

	@Test
	void keepsTheLastPricePaidUnderTheIngredientsNameOfToday() {
		List<LastPrice> prices = service.lastPrices();

		assertThat(prices).extracting(LastPrice::item).containsExactly("Beurre doux", "Boîte kraft", "Œufs");
		LastPrice butter = prices.getFirst();
		assertThat(butter.pricePerUnit()).isEqualByComparingTo("9.80");
		assertThat(butter.priceUnit()).isEqualTo(PriceUnit.KG);
		assertThat(butter.paidOn()).isEqualTo(LocalDate.parse("2026-11-03"));
	}

	@Test
	void costsAProductFromItsRecipeAndPackaging() {
		when(products.findAllByName()).thenReturn(List.of(product("12.00", "0.5", "Boîte kraft")));

		ProductCost cost = service.productCosts().getFirst();

		// Half the recipe: 125 g of butter at 9,80 €/kg, 1 egg at 0,30 €
		assertThat(cost.lines()).extracting(CostLine::name).containsExactly("Beurre doux", "Oeufs", "Sel", "Vanille");
		assertThat(cost.lines().get(0).quantity()).isEqualByComparingTo("125");
		assertThat(cost.lines().get(0).cost()).isEqualByComparingTo("1.23");
		assertThat(cost.lines().get(1).cost()).isEqualByComparingTo("0.30");
		assertThat(cost.packaging().cost()).isEqualByComparingTo("0.60");
		assertThat(cost.cost()).isEqualByComparingTo("2.13");
		assertThat(cost.margin()).isEqualByComparingTo("9.87");
		assertThat(cost.marginRate()).isEqualByComparingTo("0.8225");
	}

	@Test
	void saysWhenAPriceIsMissing() {
		when(products.findAllByName()).thenReturn(List.of(product("12.00", "1", "Boîte kraft")));

		ProductCost cost = service.productCosts().getFirst();

		// The vanilla was never bought; the salt has no quantity and does not count
		assertThat(cost.complete()).isFalse();
		assertThat(cost.lines().get(2).cost()).isNull();
		assertThat(cost.lines().get(3).pricePerUnit()).isNull();
	}

	@Test
	void costsAPackagingNeverBoughtAsUnknown() {
		ShopProduct box = product("12.00", "1", "Boîte en métal");
		box.setRecipe(null);
		when(products.findAllByName()).thenReturn(List.of(box));

		ProductCost cost = service.productCosts().getFirst();

		assertThat(cost.lines()).isEmpty();
		assertThat(cost.packaging().cost()).isNull();
		assertThat(cost.complete()).isFalse();
		assertThat(cost.cost()).isEqualByComparingTo("0");
	}

	@Test
	void givesNoMarginRateToAFreeProduct() {
		ShopProduct gift = product("0", "1", null);
		gift.setRecipe(null);
		when(products.findAllByName()).thenReturn(List.of(gift));

		ProductCost cost = service.productCosts().getFirst();

		assertThat(cost.marginRate()).isNull();
		assertThat(cost.complete()).isTrue();
		assertThat(service.costsById()).containsKey(1L);
	}

}
