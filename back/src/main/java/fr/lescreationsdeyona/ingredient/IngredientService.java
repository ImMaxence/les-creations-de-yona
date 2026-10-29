package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
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
		Ingredient created = ingredientRepository.save(newIngredient(name));
		auditLog.record(AuditAction.CREATED, AuditKind.INGREDIENT, name, created.getId());
		return toResponse(created, 0);
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
		List<String> merged = ingredientRepository.findAllById(sourceIds).stream().map(Ingredient::getName).toList();
		ingredientRepository.moveLines(target.getId(), sourceIds);
		ingredientRepository.deleteAllByIdInBatch(sourceIds);
		auditLog.record(AuditAction.MERGED, AuditKind.INGREDIENT, target.getName() + " (avec " + String.join(", ", merged) + ")",
				target.getId());
		return toResponse(target, ingredientRepository.countRecipesUsing(target.getId()));
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
		return toResponse(ingredientRepository.save(ingredient), 0);
	}

	private void trash(List<Ingredient> ingredients) {
		for (Ingredient ingredient : ingredients) {
			trashBin.put(TrashBin.Entry.of(TrashKind.INGREDIENT, ingredient.getName(), null, null,
					new TrashedIngredient(ingredient.getName(), ingredient.getAisle())));
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
