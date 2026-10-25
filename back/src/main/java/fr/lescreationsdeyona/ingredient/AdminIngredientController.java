package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Ingredients")
@RestController
@RequestMapping("/api/admin/ingredients")
@RequiredArgsConstructor
class AdminIngredientController {

	private final IngredientService ingredientService;

	@Operation(summary = "Ingredients sorted by name, with the number of recipes using each, optionally filtered (case and accents ignored)")
	@GetMapping
	List<IngredientResponse> searchIngredients(@RequestParam(required = false) @Size(max = 100) @Nullable String q) {
		return ingredientService.search(q);
	}

	@Operation(summary = "Ingredients probably written several ways (\"Pomme\", \"pommes\"), to be merged",
			description = "Case, accents, punctuation, plurals and one typo ignored (two for long names).")
	@GetMapping("/similar")
	List<SimilarIngredients> findSimilarIngredients() {
		return ingredientService.findSimilar();
	}

	@Operation(summary = "Merge ingredients: their recipes switch to the one kept, or to a new name",
			description = "The others are deleted. Refused when two of them are in the same part of a recipe.")
	@PostMapping("/merge")
	IngredientResponse mergeIngredients(@Valid @RequestBody IngredientMergeForm form) {
		return ingredientService.merge(form);
	}

	@Operation(summary = "Create an ingredient")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	IngredientResponse createIngredient(@Valid @RequestBody IngredientForm form) {
		return ingredientService.create(form);
	}

	@Operation(summary = "Rename an ingredient, in every recipe using it")
	@PutMapping("/{id}")
	IngredientResponse renameIngredient(@PathVariable long id, @Valid @RequestBody IngredientForm form) {
		return ingredientService.rename(id, form);
	}

	@Operation(summary = "Delete several ingredients, all or none; refused while a recipe uses one of them")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteIngredients(@RequestParam @NotEmpty @Size(max = 500) List<Long> ids) {
		ingredientService.deleteAll(ids);
	}

	@Operation(summary = "Delete an ingredient; refused while a recipe uses it")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteIngredient(@PathVariable long id) {
		ingredientService.delete(id);
	}

}
