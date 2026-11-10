package fr.lescreationsdeyona.accounting;

import fr.lescreationsdeyona.accounting.AccountEntryRepository.PurchaseRow;
import fr.lescreationsdeyona.accounting.AccountingResponses.CostLine;
import fr.lescreationsdeyona.accounting.AccountingResponses.LastPrice;
import fr.lescreationsdeyona.accounting.AccountingResponses.ProductCost;
import fr.lescreationsdeyona.accounting.PurchaseUnit.Measure;
import fr.lescreationsdeyona.ingredient.Ingredient;
import fr.lescreationsdeyona.ingredient.IngredientRepository;
import fr.lescreationsdeyona.recipe.RecipeDetail;
import fr.lescreationsdeyona.recipe.RecipeDetail.IngredientLine;
import fr.lescreationsdeyona.recipe.RecipeService;
import fr.lescreationsdeyona.shop.ShopProduct;
import fr.lescreationsdeyona.shop.ShopProductRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The cost price of the products of the shop: the quantities of their recipe, times the share of it
 * they take, at the last price paid for each ingredient in the purchases of the accounts; then their
 * packaging, at its last price paid too.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CostPriceService {

	private final AccountEntryRepository entryRepository;

	private final ShopProductRepository productRepository;

	private final IngredientRepository ingredientRepository;

	private final RecipeService recipeService;

	/** A price paid, per gram, millilitre or piece. */
	record Paid(String item, @Nullable Long ingredientId, Measure measure, BigDecimal perBase, LocalDate paidOn) {
	}

	/** The last price paid for each ingredient and packaging, by name (case and accents ignored). */
	Map<String, Paid> lastPaid() {
		List<PurchaseRow> rows = entryRepository.findPurchasesLatestFirst();
		Map<Long, String> names = ingredientRepository
			.findAllById(rows.stream().map(PurchaseRow::ingredientId).filter(Objects::nonNull).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Ingredient::getId, Ingredient::getName));
		Map<String, Paid> paid = new LinkedHashMap<>();
		for (PurchaseRow row : rows) {
			// Under the ingredient's name of today, should it have been renamed since
			String name = row.ingredientId() != null && names.containsKey(row.ingredientId()) ? names.get(row.ingredientId()) : row.item();
			paid.putIfAbsent(CostPrices.key(name), new Paid(name, row.ingredientId(), row.unit().measure(),
					CostPrices.perBase(row.quantity(), row.unit(), row.price()), row.occurredOn()));
		}
		return paid;
	}

	public List<LastPrice> lastPrices() {
		return lastPaid().values().stream()
			.map(paid -> new LastPrice(paid.item(), paid.ingredientId(), CostPrices.perUnit(paid.perBase(), paid.measure()),
					CostPrices.priceUnit(paid.measure()), paid.paidOn()))
			.sorted((first, second) -> CostPrices.key(first.item()).compareTo(CostPrices.key(second.item())))
			.toList();
	}

	public List<ProductCost> productCosts() {
		Map<String, Paid> paid = lastPaid();
		return productRepository.findAllByName().stream().map(product -> cost(product, paid)).toList();
	}

	/** The cost of one product, by product id; those with a recipe or a packaging only. */
	public Map<Long, ProductCost> costsById() {
		return productCosts().stream().collect(Collectors.toMap(ProductCost::productId, Function.identity()));
	}

	ProductCost cost(ShopProduct product, Map<String, Paid> paid) {
		List<CostLine> lines = new ArrayList<>();
		boolean complete = true;
		BigDecimal share = product.getRecipeShare() == null ? BigDecimal.ONE : product.getRecipeShare();
		if (product.getRecipe() != null) {
			RecipeDetail recipe = recipeService.getUnfolded(product.getRecipe().getId());
			for (RecipeDetail.Part part : recipe.parts()) {
				for (IngredientLine line : part.ingredients()) {
					CostLine costed = costLine(line, share, paid);
					complete &= costed.quantity() == null || costed.cost() != null;
					lines.add(costed);
				}
			}
		}
		CostLine packaging = null;
		if (product.getPackaging() != null) {
			BigDecimal count = BigDecimal.valueOf(product.getPackagingCount());
			Paid price = paid.get(CostPrices.key(product.getPackaging()));
			BigDecimal cost = price == null ? null : CostPrices.cost(new CostPrices.Amount(Measure.PIECE, count), price.measure(), price.perBase(), null);
			packaging = new CostLine(product.getPackaging(), count, null, price == null ? null : CostPrices.perUnit(price.perBase(), price.measure()),
					price == null ? null : CostPrices.priceUnit(price.measure()), cost);
			complete &= cost != null;
		}
		BigDecimal total = lines.stream().map(CostLine::cost).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
		if (packaging != null && packaging.cost() != null) {
			total = total.add(packaging.cost());
		}
		BigDecimal margin = product.getPrice().subtract(total);
		return new ProductCost(product.getId(), product.getName(), product.getRecipe() == null ? null : product.getRecipe().getTitle(),
				product.getPrice(), product.getBatchSize(), share, lines, packaging, total, complete, margin,
				product.getPrice().signum() == 0 ? null : margin.divide(product.getPrice(), 4, RoundingMode.HALF_UP));
	}

	/** A line of the recipe, its quantity times the product's share of it. */
	private static CostLine costLine(IngredientLine line, BigDecimal share, Map<String, Paid> paid) {
		BigDecimal quantity = line.quantity() == null ? null : plain(line.quantity().multiply(share));
		Paid price = paid.get(CostPrices.key(line.name()));
		BigDecimal cost = null;
		if (quantity != null && price != null) {
			cost = CostPrices.cost(CostPrices.amount(quantity, line.unit()), price.measure(), price.perBase(),
					line.piece() == null ? null : line.piece().grams());
		}
		return new CostLine(line.name(), quantity, line.unit(), price == null ? null : CostPrices.perUnit(price.perBase(), price.measure()),
				price == null ? null : CostPrices.priceUnit(price.measure()), cost);
	}

	/** "125", not "125.000" nor "1.25E+2". */
	static BigDecimal plain(BigDecimal quantity) {
		BigDecimal stripped = quantity.stripTrailingZeros();
		return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
	}

}
