package fr.lescreationsdeyona.accounting;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.accounting.CostPrices.Amount;
import fr.lescreationsdeyona.accounting.PurchaseUnit.Measure;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class CostPricesTest {

	private static BigDecimal perBase(String quantity, PurchaseUnit unit, String price) {
		return CostPrices.perBase(new BigDecimal(quantity), unit, new BigDecimal(price));
	}

	@Test
	void readsTheUnitsOfTheRecipes() {
		assertThat(CostPrices.amount(new BigDecimal("250"), "g")).isEqualTo(new Amount(Measure.MASS, new BigDecimal("250")));
		assertThat(CostPrices.amount(new BigDecimal("2"), "c. à soupe").base()).isEqualByComparingTo("30");
		assertThat(CostPrices.amount(new BigDecimal("2"), "c. à soupe").measure()).isEqualTo(Measure.VOLUME);
		assertThat(CostPrices.amount(new BigDecimal("1"), "Cuillère à café").base()).isEqualByComparingTo("5");
		assertThat(CostPrices.amount(new BigDecimal("20"), "cl").base()).isEqualByComparingTo("200");
		assertThat(CostPrices.amount(new BigDecimal("3"), null)).isEqualTo(new Amount(Measure.PIECE, new BigDecimal("3")));
		assertThat(CostPrices.amount(new BigDecimal("2"), "gousses").measure()).isEqualTo(Measure.PIECE);
	}

	@Test
	void pricesByTheKiloTheLitreOrThePiece() {
		BigDecimal butter = perBase("1", PurchaseUnit.KG, "9.80");
		assertThat(CostPrices.perUnit(butter, Measure.MASS)).isEqualByComparingTo("9.80");
		assertThat(CostPrices.perUnit(perBase("250", PurchaseUnit.G, "2.45"), Measure.MASS)).isEqualByComparingTo("9.80");
		assertThat(CostPrices.perUnit(perBase("50", PurchaseUnit.CL, "1.10"), Measure.VOLUME)).isEqualByComparingTo("2.20");
		assertThat(CostPrices.perUnit(perBase("6", PurchaseUnit.PIECE, "1.80"), Measure.PIECE)).isEqualByComparingTo("0.30");
	}

	@Test
	void costsAQuantityOfTheRecipe() {
		// 125 g of butter at 9,80 € the kilo
		assertThat(CostPrices.cost(CostPrices.amount(new BigDecimal("125"), "g"), Measure.MASS, perBase("1", PurchaseUnit.KG, "9.80"), null))
			.isEqualByComparingTo("1.23");
		// 20 cl of cream bought by the kilo: 1 ml taken as 1 g
		assertThat(CostPrices.cost(CostPrices.amount(new BigDecimal("20"), "cl"), Measure.MASS, perBase("1", PurchaseUnit.KG, "5.00"), null))
			.isEqualByComparingTo("1.00");
		// 1 egg at 0,30 € a piece
		assertThat(CostPrices.cost(CostPrices.amount(BigDecimal.ONE, null), Measure.PIECE, perBase("6", PurchaseUnit.PIECE, "1.80"), null))
			.isEqualByComparingTo("0.30");
	}

	@Test
	void meetsPiecesAndWeightsThroughTheWeightOfOnePiece() {
		BigDecimal eggsByThePiece = perBase("6", PurchaseUnit.PIECE, "1.80");
		// 100 g of eggs of 50 g: 2 eggs
		assertThat(CostPrices.cost(CostPrices.amount(new BigDecimal("100"), "g"), Measure.PIECE, eggsByThePiece, new BigDecimal("50")))
			.isEqualByComparingTo("0.60");
		assertThat(CostPrices.cost(CostPrices.amount(new BigDecimal("100"), "g"), Measure.PIECE, eggsByThePiece, null)).isNull();
		// 2 eggs bought by the kilo
		assertThat(CostPrices.cost(CostPrices.amount(new BigDecimal("2"), null), Measure.MASS, perBase("1", PurchaseUnit.KG, "6.00"),
				new BigDecimal("50")))
			.isEqualByComparingTo("0.60");
	}

	@Test
	void matchesNamesWhateverTheirCaseAndAccents() {
		assertThat(CostPrices.key("  Crème  fraîche ")).isEqualTo(CostPrices.key("creme fraiche"));
	}

	@Test
	void coversAMonthAQuarterOrAYear() {
		assertThat(AccountPeriod.MONTH.start(2026, 2)).isEqualTo(LocalDate.parse("2026-02-01"));
		assertThat(AccountPeriod.MONTH.end(2026, 2)).isEqualTo(LocalDate.parse("2026-02-28"));
		assertThat(AccountPeriod.QUARTER.start(2026, 4)).isEqualTo(LocalDate.parse("2026-10-01"));
		assertThat(AccountPeriod.QUARTER.end(2026, 4)).isEqualTo(LocalDate.parse("2026-12-31"));
		assertThat(AccountPeriod.YEAR.start(2026, 7)).isEqualTo(LocalDate.parse("2026-01-01"));
	}

}
