package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** A product as Open Food Facts answers it, read into the values of its label. */
class OpenFoodFactsTest {

	private final JsonMapper json = JsonMapper.builder().build();

	private OpenFoodFactsProduct read(String product) {
		return OpenFoodFacts.product(json.readTree(product));
	}

	@Test
	void readsTheLabelPer100g() {
		OpenFoodFactsProduct bueno = read("""
				{"code": "3017626998106", "product_name": "Kinder Bueno", "brands": ["Kinder", "Ferrero", "Kinder"],
				"quantity": "24*21.5 g", "nutriments": {"energy-kcal_100g": 572, "proteins_100g": 8.6, "carbohydrates_100g": 49.5,
				"sugars_100g": 41.2, "fat_100g": 37.3, "saturated-fat_100g": 17.3, "fiber_100g": 2.5, "salt_100g": 0.275}}""");

		assertThat(bueno.code()).isEqualTo("3017626998106");
		assertThat(bueno.name()).isEqualTo("Kinder Bueno");
		assertThat(bueno.brands()).isEqualTo("Kinder, Ferrero");
		assertThat(bueno.quantity()).isEqualTo("24*21.5 g");
		assertThat(bueno.per100g().kcal()).isEqualByComparingTo("572.0");
		assertThat(bueno.per100g().sugars()).isEqualByComparingTo("41.20");
		assertThat(bueno.per100g().salt()).isEqualByComparingTo("0.28");
		assertThat(bueno.per100g().isConsistent()).isTrue();
	}

	@Test
	void fillsWhatTheLabelLeavesOut() {
		// Energy in kJ only, salt as sodium, no fibre, sugars beyond the carbohydrates (mistyped)
		OpenFoodFactsProduct speculoos = read("""
				{"code": "5410126116953", "product_name_fr": "Spéculoos", "product_name": "Speculoos", "brands": "Lotus",
				"nutriments": {"energy-kj_100g": 2025, "carbohydrates_100g": 72, "sugars_100g": 80, "fat_100g": 19,
				"saturated-fat_100g": 8, "sodium_100g": 0.4, "proteins_prepared_100g": 4.9}}""");

		assertThat(speculoos.name()).isEqualTo("Spéculoos");
		assertThat(speculoos.brands()).isEqualTo("Lotus");
		assertThat(speculoos.per100g().kcal()).isEqualByComparingTo("484.0");
		assertThat(speculoos.per100g().salt()).isEqualByComparingTo("1.00");
		assertThat(speculoos.per100g().fibre()).isEqualByComparingTo("0");
		assertThat(speculoos.per100g().proteins()).isEqualByComparingTo("4.9");
		assertThat(speculoos.per100g().sugars()).isEqualByComparingTo("72");
		assertThat(speculoos.per100g().isConsistent()).isTrue();
	}

	@Test
	void leavesOutAProductWithoutNameOrEnergy() {
		assertThat(read("""
				{"code": "123", "product_name": "Sans valeurs", "nutriments": {}}""")).isNull();
		assertThat(read("""
				{"code": "123", "nutriments": {"energy-kcal_100g": 100}}""")).isNull();
		assertThat(read("""
				{"product_name": "Sans code", "nutriments": {"energy-kcal_100g": 100}}""")).isNull();
	}

}
