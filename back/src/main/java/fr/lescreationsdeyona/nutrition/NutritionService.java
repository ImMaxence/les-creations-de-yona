package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.AuditorAware;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * The nutrition facts of the recipes, from what the site knows of their ingredients (a Ciqual food, or the
 * values of a label); the Ciqual table, searched and replaced by a new version; the products of Open Food Facts.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NutritionService {

	static final int SEARCH_LIMIT = 20;

	/** The Excel table of 2025 weighs 1,5 MB. */
	static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private final JdbcClient jdbc;

	private final CiqualFoods ciqualFoods;

	private final OpenFoodFacts openFoodFacts;

	private final AuditLog auditLog;

	private final AuditorAware<String> auditor;

	/** A line of a recipe, linked recipes unfolded: "200 g Farine". */
	public record Line(String name, @Nullable BigDecimal quantity, @Nullable String unit) {
	}

	/** Per 100 g of the raw weight, graded as a food in general. */
	public RecipeNutrition compute(List<Line> lines, @Nullable Integer servings) {
		return compute(lines, servings, null, null);
	}

	/**
	 * Added up from the ingredients named by the lines; a name the site does not know counts as an ingredient without
	 * values. {@code cookedGrams}: the weight of the whole recipe once cooked, null for the raw weight; {@code kind}: the
	 * grid of its Nutri-Score, null for the general one.
	 */
	public RecipeNutrition compute(List<Line> lines, @Nullable Integer servings, @Nullable Integer cookedGrams,
			@Nullable NutriScoreKind kind) {
		Map<String, NutritionCalculator.Ingredient> ingredients = ingredients(
				lines.stream().map(Line::name).collect(Collectors.toSet()));
		return NutritionCalculator.compute(
				lines.stream().map(line -> new NutritionCalculator.Line(line.name(), line.quantity(), line.unit())).toList(),
				name -> ingredients.get(Texts.foldCaseAndAccents(name.strip())), servings, cookedGrams,
				kind == null ? NutriScoreKind.GENERAL : kind, ciqualFoods.table().version());
	}

	/** What the admin types: "beurre doux". */
	public List<CiqualFood> searchCiqual(String query) {
		return CiqualSearch.search(ciqualFoods.all(), query, SEARCH_LIMIT);
	}

	public List<OpenFoodFactsProduct> searchOpenFoodFacts(String query) {
		return openFoodFacts.search(query);
	}

	public CiqualTable ciqualTable() {
		return ciqualFoods.table();
	}

	/**
	 * A new version of the Ciqual table, in the Excel file of the Anses, in place of the one the site has. All
	 * or nothing: a file that is not the table changes nothing.
	 */
	@Transactional
	public CiqualImport importCiqual(MultipartFile file) {
		if (file.isEmpty() || file.getSize() > MAX_FILE_BYTES) {
			throw new ApiException(ErrorCode.CIQUAL_FILE_INVALID);
		}
		List<CiqualRow> rows;
		try (InputStream content = file.getInputStream()) {
			rows = CiqualWorkbook.read(content);
		}
		catch (IOException ex) {
			throw new ApiException(ErrorCode.CIQUAL_FILE_INVALID);
		}
		CiqualTable before = ciqualFoods.table();
		String version = CiqualWorkbook.versionOf(file.getOriginalFilename(), LocalDate.now(PARIS));
		CiqualImport imported = ciqualFoods.replace(rows, version, auditor.getCurrentAuditor().orElse(AuditLog.SITE));
		AuditChanges changes = new AuditChanges().add("Version", before.version(), imported.version())
			.add("Aliments", before.foodCount(), imported.foodCount());
		if (!imported.unlinkedIngredients().isEmpty()) {
			changes.add("Ingrédients à lier de nouveau", null, imported.unlinkedIngredients());
		}
		auditLog.record(AuditAction.IMPORTED, AuditKind.INGREDIENT, "Table " + imported.version(), null, changes);
		return imported;
	}

	/** By folded name: what the site knows of each of these ingredients. */
	private Map<String, NutritionCalculator.Ingredient> ingredients(Set<String> names) {
		Set<String> asked = names.stream().filter(StringUtils::hasText).map(String::strip).collect(Collectors.toSet());
		if (asked.isEmpty()) {
			return Map.of();
		}
		Map<String, NutritionCalculator.Ingredient> found = new HashMap<>();
		jdbc.sql("""
				select i.name, i.piece_grams, i.edible_percent, i.label_kcal, i.label_proteins, i.label_carbohydrates, i.label_sugars, i.label_fat,
				i.label_saturated_fat, i.label_fibre, i.label_salt, f.code, f.name as food_name, f.subgroup_code, f.subgroup_name,
				f.kcal, f.proteins, f.carbohydrates, f.sugars, f.fat, f.saturated_fat, f.fibre, f.salt
				from ingredient i left join ciqual_food f on f.code = i.ciqual_code
				where i.name in (:names)""")
			.param("names", asked)
			.query((ResultSet rs) -> {
				found.put(Texts.foldCaseAndAccents(rs.getString("name").strip()), ingredient(rs));
			});
		return found;
	}

	private static NutritionCalculator.Ingredient ingredient(ResultSet rs) throws SQLException {
		BigDecimal pieceGrams = rs.getBigDecimal("piece_grams");
		int edible = rs.getInt("edible_percent");
		BigDecimal labelKcal = rs.getBigDecimal("label_kcal");
		if (labelKcal != null) {
			NutritionFacts label = new NutritionFacts(labelKcal.doubleValue(), rs.getDouble("label_proteins"),
					rs.getDouble("label_carbohydrates"), rs.getDouble("label_sugars"), rs.getDouble("label_fat"),
					rs.getDouble("label_saturated_fat"), rs.getDouble("label_fibre"), rs.getDouble("label_salt"));
			return new NutritionCalculator.Ingredient(label, false, true, pieceGrams, edible);
		}
		if (rs.getObject("code") == null) {
			return new NutritionCalculator.Ingredient(null, false, false, pieceGrams, edible);
		}
		CiqualFood food = new CiqualRow(rs.getInt("code"), rs.getString("food_name"), rs.getString("subgroup_code"),
				rs.getString("subgroup_name"), rs.getBigDecimal("kcal"), rs.getBigDecimal("proteins"), rs.getBigDecimal("carbohydrates"),
				rs.getBigDecimal("sugars"), rs.getBigDecimal("fat"), rs.getBigDecimal("saturated_fat"), rs.getBigDecimal("fibre"),
				rs.getBigDecimal("salt"))
			.food();
		return new NutritionCalculator.Ingredient(food.per100g(), food.isFruitVegetableOrLegume(), false, pieceGrams, edible);
	}

}
