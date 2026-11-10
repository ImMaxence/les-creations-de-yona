package fr.lescreationsdeyona.shop;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.category.Category;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ShopProductTest {

	private static ShopProduct product(String price, Integer batchSize, String portionLabel) {
		ShopProduct product = new ShopProduct();
		product.setName("Cookies");
		product.setPrice(new BigDecimal(price));
		product.setBatchSize(batchSize);
		product.setPortionLabel(portionLabel);
		product.setAvailable(true);
		return product;
	}

	@Test
	void sellsByBatchesWithThePriceOfOnePiece() {
		ShopProduct box = product("12.00", 6, null);

		assertThat(box.format()).isEqualTo("Boîte de 6");
		assertThat(box.formatLabel()).isEqualTo("Boîte de 6");
		assertThat(box.unitPrice()).isEqualByComparingTo("2.00");
		assertThat(product("10.00", 3, null).unitPrice()).isEqualByComparingTo("3.33");
	}

	@Test
	void sellsByTheUnit() {
		ShopProduct cake = product("25.00", null, "le gâteau, 8 parts");

		assertThat(cake.format()).isEqualTo("À l'unité");
		assertThat(cake.formatLabel()).isEqualTo("le gâteau, 8 parts");
		assertThat(cake.unitPrice()).isNull();
		assertThat(product("25.00", null, null).formatLabel()).isEqualTo("À l'unité");
	}

	@Test
	void takesItsRecipesCategoriesOrItsOwn() {
		Category desserts = new Category();
		desserts.setName("Desserts");
		Category gifts = new Category();
		gifts.setName("Cadeaux");
		ShopProduct alone = product("20.00", null, null);
		alone.setCategory(gifts);
		assertThat(alone.categories()).containsExactly(gifts);

		Recipe recipe = new Recipe();
		recipe.getCategories().add(desserts);
		recipe.setStatus(RecipeStatus.DRAFT);
		alone.setRecipe(recipe);
		assertThat(alone.categories()).containsExactly(desserts);
		// Its recipe a draft, it is not on sale
		assertThat(alone.onSale()).isFalse();
	}

}
