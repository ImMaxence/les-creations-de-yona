package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.List;
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

	private final IngredientMapper ingredientMapper;

	/** All ingredients, or those whose name contains {@code query} (case and accents ignored). */
	public List<IngredientResponse> search(@Nullable String query) {
		List<Ingredient> ingredients = StringUtils.hasText(query)
				? ingredientRepository.findByNameContainingOrderByNameAsc(query.strip())
				: ingredientRepository.findAll(Sort.by("name"));
		return ingredients.stream().map(ingredientMapper::toResponse).toList();
	}

	@Transactional
	public IngredientResponse create(IngredientForm form) {
		String name = form.name().strip();
		if (ingredientRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.INGREDIENT_ALREADY_EXISTS);
		}
		return ingredientMapper.toResponse(ingredientRepository.save(newIngredient(name)));
	}

	@Transactional
	public IngredientResponse rename(long id, IngredientForm form) {
		Ingredient ingredient = find(id);
		String name = form.name().strip();
		boolean takenByAnother = ingredientRepository.findByName(name)
			.filter(other -> !other.getId().equals(ingredient.getId()))
			.isPresent();
		if (takenByAnother) {
			throw new ApiException(ErrorCode.INGREDIENT_ALREADY_EXISTS);
		}
		ingredient.setName(name);
		return ingredientMapper.toResponse(ingredient);
	}

	@Transactional
	public void delete(long id) {
		Ingredient ingredient = find(id);
		if (ingredientRepository.isUsedInRecipe(id)) {
			throw new ApiException(ErrorCode.INGREDIENT_IN_USE);
		}
		ingredientRepository.delete(ingredient);
	}

	/** Used by the recipe form: the admin types a name, an existing ingredient is reused if any. */
	@Transactional
	public Ingredient findOrCreate(String name) {
		String strippedName = name.strip();
		return ingredientRepository.findByName(strippedName)
			.orElseGet(() -> ingredientRepository.save(newIngredient(strippedName)));
	}

	private Ingredient find(long id) {
		return ingredientRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.INGREDIENT_NOT_FOUND));
	}

	private static Ingredient newIngredient(String name) {
		Ingredient ingredient = new Ingredient();
		ingredient.setName(name);
		return ingredient;
	}

}
