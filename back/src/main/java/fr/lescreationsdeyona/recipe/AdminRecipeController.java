package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.image.ImageChoice;
import fr.lescreationsdeyona.image.ImageProcessor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Recipes")
@RestController
@RequestMapping("/api/admin/recipes")
@RequiredArgsConstructor
class AdminRecipeController {

	private final RecipeService recipeService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "All recipes, drafts included", description = "Sort on title, createdAt or updatedAt.")
	@GetMapping
	PageResponse<RecipeAdminSummary> searchRecipes(
			@Parameter(description = "Part of the title, case and accents ignored")
			@RequestParam(required = false) @Size(max = 100) @Nullable String q,
			@Parameter(description = "Category slug")
			@RequestParam(required = false) @Nullable String category,
			@RequestParam(required = false) @Nullable RecipeStatus status,
			@ParameterObject @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		return PageResponse.of(recipeService.searchAll(q, category, status, pageable));
	}

	@Operation(summary = "A recipe, for the edit form")
	@GetMapping("/{id}")
	RecipeDetail getRecipe(@PathVariable long id) {
		return recipeService.get(id);
	}

	@Operation(summary = "Create a recipe",
			description = "Featuring a recipe unfeatures the previous one. Unknown ingredients are created.")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	RecipeDetail createRecipe(@Valid @RequestBody RecipeForm form) {
		return recipeService.create(form);
	}

	@Operation(summary = "Update a recipe (its slug does not change)",
			description = "Featuring a recipe unfeatures the previous one. Unknown ingredients are created.")
	@PutMapping("/{id}")
	RecipeDetail updateRecipe(@PathVariable long id, @Valid @RequestBody RecipeForm form) {
		return recipeService.update(id, form);
	}

	@Operation(summary = "Delete a recipe with its ingredients and steps; its photo stays in the gallery")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteRecipe(@PathVariable long id) {
		recipeService.delete(id);
	}

	@Operation(summary = "Upload a new photo for a recipe; the previous one stays in the gallery",
			description = "JPEG or PNG, 10 MB max, landscape: at least 1200 × 800 px and 4:3.")
	@PutMapping(path = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	RecipeDetail replaceRecipeImage(@PathVariable long id, @RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		return recipeService.replaceImage(id, imageProcessor.process(file));
	}

	@Operation(summary = "Show an image of the gallery on a recipe, or none (default visual)")
	@PutMapping("/{id}/image-choice")
	RecipeDetail chooseRecipeImage(@PathVariable long id, @RequestBody ImageChoice choice) {
		return recipeService.chooseImage(id, choice.imageId());
	}

}
