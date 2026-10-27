package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IngredientService {

	private final IngredientRepository ingredientRepository;

	/** All ingredients, or those whose name contains {@code query} (case and accents ignored), by name. */
	public List<IngredientResponse> search(@Nullable String query) {
		List<Ingredient> ingredients = StringUtils.hasText(query)
				? ingredientRepository.findByNameContainingOrderByNameAsc(query.strip())
				: ingredientRepository.findAll(Sort.by("name"));
		Map<Long, Long> recipeCounts = recipeCounts();
		return ingredients.stream()
			.map(ingredient -> toResponse(ingredient, recipeCounts.getOrDefault(ingredient.getId(), 0L)))
			.toList();
	}

	/** For the ingredient filter of the public recipes page. */
	public List<String> publishedNames() {
		return ingredientRepository.findPublishedNames();
	}

	/** For the shopping list, sorted by aisle. */
	public List<IngredientAisle> publishedAisles() {
		return ingredientRepository.findPublishedAisles();
	}

	/** Ingredients probably written several ways ("Pomme", "pommes"), each group the most used first. */
	public List<SimilarIngredients> findSimilar() {
		Map<Long, Long> recipeCounts = recipeCounts();
		List<IngredientResponse> ingredients = ingredientRepository.findAll(Sort.by("name"))
			.stream()
			.map(ingredient -> toResponse(ingredient, recipeCounts.getOrDefault(ingredient.getId(), 0L)))
			.toList();
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
		return toResponse(ingredientRepository.save(newIngredient(name)), 0);
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
		ingredient.setName(name);
		return toResponse(ingredient, ingredientRepository.countRecipesUsing(id));
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
		ingredientRepository.moveLines(target.getId(), sourceIds);
		ingredientRepository.deleteAllByIdInBatch(sourceIds);
		return toResponse(target, ingredientRepository.countRecipesUsing(target.getId()));
	}

	@Transactional
	public void delete(long id) {
		Ingredient ingredient = find(id);
		if (ingredientRepository.countRecipesUsing(id) > 0) {
			throw new ApiException(ErrorCode.INGREDIENT_IN_USE);
		}
		ingredientRepository.delete(ingredient);
	}

	/** All or none: refused while a recipe uses one of them, naming those. */
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
		ingredientRepository.deleteAll(ingredients);
	}

	/** Shelves the ingredients in an aisle, or takes them out of any ({@code aisle} null). */
	@Transactional
	public void setAisle(Collection<Long> ids, @Nullable Aisle aisle) {
		List<Ingredient> ingredients = ingredientRepository.findAllById(ids);
		if (ingredients.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.INGREDIENT_NOT_FOUND);
		}
		ingredients.forEach(ingredient -> ingredient.setAisle(aisle));
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

	private Ingredient find(long id) {
		return ingredientRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.INGREDIENT_NOT_FOUND));
	}

	private static String quoted(List<String> names) {
		return names.stream().map(name -> "« " + name + " »").collect(Collectors.joining(", "));
	}

	private static IngredientResponse toResponse(Ingredient ingredient, long recipeCount) {
		return new IngredientResponse(ingredient.getId(), ingredient.getName(), ingredient.getAisle(), recipeCount);
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
