package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.nutrition.CiqualFood;
import fr.lescreationsdeyona.nutrition.CiqualFoods;
import fr.lescreationsdeyona.nutrition.CiqualSearch;
import fr.lescreationsdeyona.nutrition.NutritionLabel;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IngredientService {

	private final IngredientRepository ingredientRepository;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	private final CiqualFoods ciqualFoods;

	/** All ingredients, or those whose name contains {@code query} (case and accents ignored), by name. */
	public List<IngredientResponse> search(@Nullable String query) {
		List<Ingredient> ingredients = StringUtils.hasText(query)
				? ingredientRepository.findByNameContainingOrderByNameAsc(query.strip())
				: ingredientRepository.findAll(Sort.by("name"));
		return toResponses(ingredients);
	}

	/**
	 * The ingredients without nutrition facts and the {@code limit} Ciqual foods they most probably are: those named,
	 * or else those of at least one recipe, the most used first.
	 */
	public List<NutritionSuggestion> nutritionSuggestions(@Nullable List<String> names, int limit) {
		List<Ingredient> ingredients = names == null || names.isEmpty() ? ingredientRepository.findAll()
				: names.stream().map(String::strip).distinct().map(ingredientRepository::findByName).flatMap(Optional::stream).toList();
		Map<Long, Long> recipeCounts = recipeCounts();
		List<CiqualFood> foods = ciqualFoods.all();
		return ingredients.stream()
			.filter(ingredient -> !hasNutrition(ingredient))
			.filter(ingredient -> names != null && !names.isEmpty() || recipeCounts.containsKey(ingredient.getId()))
			.sorted(Comparator.comparingLong((Ingredient ingredient) -> -recipeCounts.getOrDefault(ingredient.getId(), 0L))
				.thenComparing(Ingredient::getName))
			.map(ingredient -> new NutritionSuggestion(
					toResponse(ingredient, recipeCounts.getOrDefault(ingredient.getId(), 0L), Map.of()),
					CiqualSearch.suggest(foods, ingredient.getName(), limit)))
			.toList();
	}

	/** Its Ciqual food, or the values of its label, or none: what the recipes using it count. */
	@Transactional
	public IngredientResponse setNutrition(long id, IngredientNutritionForm form) {
		Ingredient ingredient = find(id);
		if (form.ciqualCode() != null && form.label() != null) {
			throw new ApiException(ErrorCode.INGREDIENT_NUTRITION_INVALID);
		}
		if (form.label() != null && !form.label().isConsistent()) {
			throw new ApiException(ErrorCode.NUTRITION_LABEL_INCONSISTENT);
		}
		String before = nutritionLabel(ingredient);
		if (form.ciqualCode() != null) {
			ciqualFoods.find(form.ciqualCode()).orElseThrow(() -> new ApiException(ErrorCode.CIQUAL_FOOD_NOT_FOUND));
		}
		setNutrition(ingredient, form);
		auditLog.record(AuditAction.UPDATED, AuditKind.INGREDIENT, ingredient.getName(), id,
				new AuditChanges().add("Valeurs nutritionnelles", before, nutritionLabel(ingredient)));
		return toResponse(ingredient);
	}

	/** "Tout lier": each ingredient to its Ciqual food, all or none. */
	@Transactional
	public void linkToCiqual(List<IngredientCiqualLinksForm.Link> links) {
		Map<Long, Integer> codesById = new LinkedHashMap<>();
		links.forEach(link -> codesById.put(link.ingredientId(), link.ciqualCode()));
		List<Ingredient> ingredients = ingredientRepository.findAllById(codesById.keySet());
		if (ingredients.size() != codesById.size()) {
			throw new ApiException(ErrorCode.INGREDIENT_NOT_FOUND);
		}
		Map<Integer, CiqualFood> foods = ciqualFoods.findAll(codesById.values());
		if (!foods.keySet().containsAll(codesById.values())) {
			throw new ApiException(ErrorCode.CIQUAL_FOOD_NOT_FOUND);
		}
		AuditChanges changes = new AuditChanges();
		for (Ingredient ingredient : ingredients.stream().sorted(Comparator.comparing(Ingredient::getName)).toList()) {
			String before = nutritionLabel(ingredient);
			setNutrition(ingredient, new IngredientNutritionForm(codesById.get(ingredient.getId()), null, null));
			changes.add("Valeurs nutritionnelles de " + ingredient.getName(), before, nutritionLabel(ingredient));
		}
		auditLog.record(AuditAction.UPDATED, AuditKind.INGREDIENT, ingredients.size() == 1 ? ingredients.getFirst().getName()
				: ingredients.size() + " ingrédients", ingredients.size() == 1 ? ingredients.getFirst().getId() : null, changes);
	}

	/** For the ingredient filter of the public recipes page. */
	@Cacheable(PublicCache.INGREDIENTS)
	public List<String> publishedNames() {
		return ingredientRepository.findPublishedNames();
	}

	/** For the shopping list, sorted by aisle. */
	@Cacheable(PublicCache.AISLES)
	public List<IngredientAisle> publishedAisles() {
		return ingredientRepository.findPublishedAisles();
	}

	/** Ingredients probably written several ways ("Pomme", "pommes"), each group the most used first. */
	public List<SimilarIngredients> findSimilar() {
		List<IngredientResponse> ingredients = toResponses(ingredientRepository.findAll(Sort.by("name")));
		return SimilarNames.groups(ingredients, IngredientResponse::name)
			.stream()
			.map(group -> new SimilarIngredients(group.stream()
				.sorted(Comparator.comparingLong(IngredientResponse::recipeCount).reversed())
				.toList()))
			.toList();
	}

	@Transactional
	public IngredientResponse create(IngredientForm form) {
		String name = normalized(form.name());
		if (ingredientRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.INGREDIENT_ALREADY_EXISTS);
		}
		Ingredient created = ingredientRepository.save(newIngredient(name));
		auditLog.record(AuditAction.CREATED, AuditKind.INGREDIENT, name, created.getId());
		return toResponse(created, 0, Map.of());
	}

	@Transactional
	public IngredientResponse rename(long id, IngredientForm form) {
		Ingredient ingredient = find(id);
		String name = normalized(form.name());
		boolean takenByAnother = ingredientRepository.findByName(name)
			.filter(other -> !other.getId().equals(ingredient.getId()))
			.isPresent();
		if (takenByAnother) {
			throw new ApiException(ErrorCode.INGREDIENT_ALREADY_EXISTS);
		}
		AuditChanges changes = new AuditChanges().add("Nom", ingredient.getName(), name);
		ingredient.setName(name);
		auditLog.record(AuditAction.UPDATED, AuditKind.INGREDIENT, name, id, changes);
		return toResponse(ingredient);
	}

	/**
	 * Every recipe using one of the ingredients switches to the one kept (or to the one named
	 * {@code newName}, created unless it exists); the others are deleted. Refused when two of them
	 * are in the same part of a recipe: their lines would collide.
	 */
	@Transactional
	public IngredientResponse merge(IngredientMergeForm form) {
		Set<Long> ids = new LinkedHashSet<>(form.ingredientIds());
		if (ids.size() < 2) {
			throw new ApiException(ErrorCode.INGREDIENT_MERGE_INVALID);
		}
		if (ingredientRepository.findAllById(ids).size() != ids.size()) {
			throw new ApiException(ErrorCode.INGREDIENT_NOT_FOUND);
		}
		Ingredient target = mergeTarget(ids, form.keptId(), form.newName());
		Set<Long> involved = new HashSet<>(ids);
		involved.add(target.getId());
		List<String> collisions = ingredientRepository.findRecipesListingTwiceAny(involved);
		if (!collisions.isEmpty()) {
			throw new ApiException(ErrorCode.INGREDIENT_MERGE_CONFLICT, "Fusion impossible : ces ingrédients figurent "
					+ "ensemble dans une même partie de " + quoted(collisions) + ". Corrigez d'abord la recette");
		}
		Set<Long> sourceIds = new HashSet<>(ids);
		sourceIds.remove(target.getId());
		// The aisle of the merged ones, unless the one kept has its own
		if (target.getAisle() == null) {
			ingredientRepository.findAllById(sourceIds)
				.stream()
				.map(Ingredient::getAisle)
				.filter(Objects::nonNull)
				.findFirst()
				.ifPresent(target::setAisle);
		}
		// The same for the weight of a piece
		if (target.getPieceGrams() == null) {
			ingredientRepository.findAllById(sourceIds)
				.stream()
				.map(IngredientService::piece)
				.filter(Objects::nonNull)
				.findFirst()
				.ifPresent(piece -> setPiece(target, piece));
		}
		// And for the nutrition facts
		if (!hasNutrition(target)) {
			ingredientRepository.findAllById(sourceIds)
				.stream()
				.map(IngredientService::nutritionForm)
				.filter(Objects::nonNull)
				.findFirst()
				.ifPresent(nutrition -> setNutrition(target, nutrition));
		}
		List<String> merged = ingredientRepository.findAllById(sourceIds).stream().map(Ingredient::getName).toList();
		ingredientRepository.moveLines(target.getId(), sourceIds);
		ingredientRepository.movePurchases(target.getId(), sourceIds);
		ingredientRepository.deleteAllByIdInBatch(sourceIds);
		auditLog.record(AuditAction.MERGED, AuditKind.INGREDIENT, target.getName() + " (avec " + String.join(", ", merged) + ")",
				target.getId());
		return toResponse(target);
	}

	/** To the trash for 30 days; refused while a recipe uses it. */
	@Transactional
	public void delete(long id) {
		Ingredient ingredient = find(id);
		if (ingredientRepository.countRecipesUsing(id) > 0) {
			throw new ApiException(ErrorCode.INGREDIENT_IN_USE);
		}
		trash(List.of(ingredient));
	}

	/** All or none, to the trash for 30 days: refused while a recipe uses one of them, naming those. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Ingredient> ingredients = ingredientRepository.findAllById(ids);
		if (ingredients.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.INGREDIENT_NOT_FOUND);
		}
		Map<Long, Long> recipeCounts = recipeCounts();
		List<String> inUse = ingredients.stream()
			.filter(ingredient -> recipeCounts.containsKey(ingredient.getId()))
			.map(Ingredient::getName)
			.toList();
		if (!inUse.isEmpty()) {
			throw new ApiException(ErrorCode.INGREDIENT_IN_USE, "Suppression annulée : " + quoted(inUse)
					+ (inUse.size() > 1 ? " sont utilisés" : " est utilisé") + " dans au moins une recette");
		}
		trash(ingredients);
	}

	/** Created again from the trash, with its aisle; refused when another ingredient has taken its name. */
	@Transactional
	public IngredientResponse restoreFromTrash(TrashItem trashed) {
		TrashedIngredient kept = trashBin.content(trashed, TrashedIngredient.class);
		if (ingredientRepository.existsByName(kept.name())) {
			throw new ApiException(ErrorCode.INGREDIENT_ALREADY_EXISTS);
		}
		Ingredient ingredient = newIngredient(kept.name());
		ingredient.setAisle(kept.aisle());
		setPiece(ingredient, kept.piece());
		IngredientNutritionForm nutrition = kept.nutrition();
		// Its Ciqual food may have left the table since (a new version): to be linked again then
		if (nutrition != null && (nutrition.ciqualCode() == null || ciqualFoods.find(nutrition.ciqualCode()).isPresent())) {
			setNutrition(ingredient, nutrition);
		}
		return toResponse(ingredientRepository.save(ingredient));
	}

	private void trash(List<Ingredient> ingredients) {
		for (Ingredient ingredient : ingredients) {
			trashBin.put(TrashBin.Entry.of(TrashKind.INGREDIENT, ingredient.getName(), null, null,
					new TrashedIngredient(ingredient.getName(), ingredient.getAisle(), piece(ingredient), nutritionForm(ingredient))));
		}
		ingredientRepository.deleteAll(ingredients);
	}

	/** Shelves the ingredients in an aisle, or takes them out of any ({@code aisle} null). */
	@Transactional
	public void setAisle(Collection<Long> ids, @Nullable Aisle aisle) {
		List<Ingredient> ingredients = ingredientRepository.findAllById(ids);
		if (ingredients.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.INGREDIENT_NOT_FOUND);
		}
		AuditChanges changes = new AuditChanges().add("Rayon",
				ingredients.stream().map(ingredient -> aisleLabel(ingredient.getAisle())).distinct().toList(), aisleLabel(aisle));
		if (ingredients.size() > 1) {
			changes.add("Ingrédients", null, ingredients.stream().map(Ingredient::getName).sorted().toList());
		}
		ingredients.forEach(ingredient -> ingredient.setAisle(aisle));
		auditLog.record(AuditAction.UPDATED, AuditKind.INGREDIENT, ingredients.size() == 1 ? ingredients.getFirst().getName()
				: ingredients.size() + " ingrédients", ingredients.size() == 1 ? ingredients.getFirst().getId() : null, changes);
	}

	/** What one piece weighs, or nothing for an ingredient bought by weight. */
	@Transactional
	public IngredientResponse setPiece(long id, @Nullable IngredientPiece piece) {
		Ingredient ingredient = find(id);
		IngredientPiece cleaned = piece == null ? null
				: new IngredientPiece(piece.grams(), piece.singular().strip(), piece.plural().strip());
		AuditChanges changes = new AuditChanges().add("Équivalent", pieceLabel(piece(ingredient)), pieceLabel(cleaned));
		setPiece(ingredient, cleaned);
		auditLog.record(AuditAction.UPDATED, AuditKind.INGREDIENT, ingredient.getName(), id, changes);
		return toResponse(ingredient);
	}

	/** Used by the recipe form: the admin types a name, an existing ingredient is reused if any. */
	@Transactional
	public Ingredient findOrCreate(String name) {
		String normalizedName = normalized(name);
		return ingredientRepository.findByName(normalizedName)
			.orElseGet(() -> ingredientRepository.save(newIngredient(normalizedName)));
	}

	/**
	 * The kept ingredient; or the one named {@code newName}, renamed to this exact spelling (it may
	 * be one of the merged ones, written differently) or created.
	 */
	private Ingredient mergeTarget(Set<Long> ids, @Nullable Long keptId, @Nullable String newName) {
		if (StringUtils.hasText(newName)) {
			String name = normalized(newName);
			Ingredient target = ingredientRepository.findByName(name)
				.orElseGet(() -> ingredientRepository.save(newIngredient(name)));
			target.setName(name);
			return target;
		}
		if (keptId == null || !ids.contains(keptId)) {
			throw new ApiException(ErrorCode.INGREDIENT_MERGE_INVALID);
		}
		return find(keptId);
	}

	private Map<Long, Long> recipeCounts() {
		return ingredientRepository.countRecipesPerIngredient()
			.stream()
			.collect(Collectors.toMap(RecipeCount::ingredientId, RecipeCount::recipes));
	}

	/** As the back-office names them; without aisle, "Autres" on the shopping list. */
	private static String aisleLabel(@Nullable Aisle aisle) {
		return switch (aisle) {
			case null -> "Aucun";
			case FRUITS_VEGETABLES -> "Fruits et légumes";
			case MEAT_FISH -> "Viandes et poissons";
			case FRESH -> "Rayon frais";
			case DAIRY_EGGS -> "Crèmerie et œufs";
			case SAVORY_GROCERY -> "Épicerie salée";
			case SWEET_GROCERY -> "Épicerie sucrée et pâtisserie";
			case FROZEN -> "Surgelés";
			case DRINKS -> "Boissons";
		};
	}

	private Ingredient find(long id) {
		return ingredientRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.INGREDIENT_NOT_FOUND));
	}

	private static String quoted(List<String> names) {
		return names.stream().map(name -> "« " + name + " »").collect(Collectors.joining(", "));
	}

	/** With the number of recipes using each, and their Ciqual foods read at once. */
	private List<IngredientResponse> toResponses(List<Ingredient> ingredients) {
		Map<Long, Long> recipeCounts = recipeCounts();
		Map<Integer, CiqualFood> foods = ciqualFoods.findAll(codes(ingredients));
		return ingredients.stream()
			.map(ingredient -> toResponse(ingredient, recipeCounts.getOrDefault(ingredient.getId(), 0L), foods))
			.toList();
	}

	private IngredientResponse toResponse(Ingredient ingredient) {
		return toResponse(ingredient, ingredient.getId() == null ? 0 : ingredientRepository.countRecipesUsing(ingredient.getId()),
				ciqualFoods.findAll(codes(List.of(ingredient))));
	}

	/** {@code foods}: the Ciqual foods of the ingredients, by code. */
	private static IngredientResponse toResponse(Ingredient ingredient, long recipeCount, Map<Integer, CiqualFood> foods) {
		return new IngredientResponse(ingredient.getId(), ingredient.getName(), ingredient.getAisle(), recipeCount,
				piece(ingredient), nutrition(ingredient, foods));
	}

	private static Set<Integer> codes(List<Ingredient> ingredients) {
		return ingredients.stream().map(Ingredient::getCiqualCode).filter(Objects::nonNull).collect(Collectors.toSet());
	}

	private static boolean hasNutrition(Ingredient ingredient) {
		return ingredient.getCiqualCode() != null || ingredient.getLabelKcal() != null;
	}

	private static @Nullable IngredientNutrition nutrition(Ingredient ingredient, Map<Integer, CiqualFood> foods) {
		NutritionLabel label = label(ingredient);
		if (label != null) {
			return new IngredientNutrition(null, null, label, ingredient.getLabelSource(), label.facts().rounded());
		}
		CiqualFood food = ingredient.getCiqualCode() == null ? null : foods.get(ingredient.getCiqualCode());
		return food == null ? null : new IngredientNutrition(food.code(), food.name(), null, null, food.per100g().rounded());
	}

	private static @Nullable NutritionLabel label(Ingredient ingredient) {
		return ingredient.getLabelKcal() == null ? null
				: new NutritionLabel(ingredient.getLabelKcal(), ingredient.getLabelProteins(), ingredient.getLabelCarbohydrates(),
						ingredient.getLabelSugars(), ingredient.getLabelFat(), ingredient.getLabelSaturatedFat(), ingredient.getLabelFibre(),
						ingredient.getLabelSalt());
	}

	/** What saves its nutrition facts again (the trash, a merge); null without any. */
	private static @Nullable IngredientNutritionForm nutritionForm(Ingredient ingredient) {
		NutritionLabel label = label(ingredient);
		if (label != null) {
			return new IngredientNutritionForm(null, label, ingredient.getLabelSource());
		}
		return ingredient.getCiqualCode() == null ? null : new IngredientNutritionForm(ingredient.getCiqualCode(), null, null);
	}

	/** A Ciqual food, or a label, or none: the other one is cleared. */
	private static void setNutrition(Ingredient ingredient, IngredientNutritionForm form) {
		NutritionLabel label = form.ciqualCode() == null ? form.label() : null;
		ingredient.setCiqualCode(form.ciqualCode());
		ingredient.setLabelKcal(label == null ? null : label.kcal());
		ingredient.setLabelProteins(label == null ? null : label.proteins());
		ingredient.setLabelCarbohydrates(label == null ? null : label.carbohydrates());
		ingredient.setLabelSugars(label == null ? null : label.sugars());
		ingredient.setLabelFat(label == null ? null : label.fat());
		ingredient.setLabelSaturatedFat(label == null ? null : label.saturatedFat());
		ingredient.setLabelFibre(label == null ? null : label.fibre());
		ingredient.setLabelSalt(label == null ? null : label.salt());
		ingredient.setLabelSource(label == null || !StringUtils.hasText(form.labelSource()) ? null : form.labelSource().strip());
	}

	/** "Ciqual : Beurre à 80% MG minimum, doux", "Étiquette : 380 kcal pour 100 g (Open Food Facts · …)", for the history. */
	private @Nullable String nutritionLabel(Ingredient ingredient) {
		if (ingredient.getLabelKcal() != null) {
			String kcal = ingredient.getLabelKcal().stripTrailingZeros().toPlainString().replace('.', ',');
			return "Étiquette : " + kcal + " kcal pour 100 g"
					+ (ingredient.getLabelSource() == null ? "" : " (" + ingredient.getLabelSource() + ")");
		}
		Integer code = ingredient.getCiqualCode();
		return code == null ? null
				: "Ciqual : " + ciqualFoods.find(code).map(CiqualFood::name).orElse("aliment n° " + code);
	}

	private static @Nullable IngredientPiece piece(Ingredient ingredient) {
		return ingredient.getPieceGrams() == null ? null
				: new IngredientPiece(ingredient.getPieceGrams(), ingredient.getPieceSingular(), ingredient.getPiecePlural());
	}

	private static void setPiece(Ingredient ingredient, @Nullable IngredientPiece piece) {
		ingredient.setPieceGrams(piece == null ? null : piece.grams());
		ingredient.setPieceSingular(piece == null ? null : piece.singular());
		ingredient.setPiecePlural(piece == null ? null : piece.plural());
	}

	/** "1 œuf = 50 g", for the history. */
	private static @Nullable String pieceLabel(@Nullable IngredientPiece piece) {
		return piece == null ? null
				: "1 " + piece.singular() + " = " + piece.grams().stripTrailingZeros().toPlainString().replace('.', ',') + " g";
	}

	/** Like recipe titles and category names: "beurre" is saved as "Beurre", "🧈 beurre" as "🧈 Beurre". */
	private static String normalized(String name) {
		return Texts.capitalizeFirstLetter(name.strip());
	}

	private static Ingredient newIngredient(String name) {
		Ingredient ingredient = new Ingredient();
		ingredient.setName(name);
		return ingredient;
	}

}
