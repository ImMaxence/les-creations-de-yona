package fr.lescreationsdeyona.recipe;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Recipe trash")
@RestController
@RequestMapping("/api/admin/recipe-trash")
@RequiredArgsConstructor
class AdminRecipeTrashController {

	private final RecipeTrashService trashService;

	private final RecipeService recipeService;

	@Operation(summary = "Deleted recipes, kept 30 days; the last deleted first")
	@GetMapping
	List<TrashedRecipe> listTrashedRecipes() {
		return trashService.list();
	}

	@Operation(summary = "Restore a deleted recipe",
			description = "Same URL if still free, same dates; its photos, categories and tags that still exist. "
					+ "Refused when none of its categories exists any more.")
	@PostMapping("/{id}/restore")
	RecipeDetail restoreTrashedRecipe(@PathVariable long id) {
		return recipeService.restoreFromTrash(id);
	}

	@Operation(summary = "Erase a deleted recipe for good; its photo stays in the gallery")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void eraseTrashedRecipe(@PathVariable long id) {
		trashService.erase(id);
	}

	@Operation(summary = "Empty the trash")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void emptyRecipeTrash() {
		trashService.eraseAll();
	}

}
