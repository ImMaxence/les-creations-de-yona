package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.image.ImageChoice;
import fr.lescreationsdeyona.image.ImageProcessor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
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

	@Operation(summary = "All recipes, drafts included",
			description = "Sort on title, createdAt, updatedAt, publishedAt or viewCount; id as a second sort keeps equal ones in order.")
	@GetMapping
	PageResponse<RecipeAdminSummary> searchRecipes(
			@Parameter(description = "Part of the title, case and accents ignored")
			@RequestParam(required = false) @Size(max = 100) @Nullable String q,
			@Parameter(description = "Category slug")
			@RequestParam(required = false) @Nullable String category,
			@Parameter(description = "Tag slug")
			@RequestParam(required = false) @Nullable String tag,
			@Parameter(description = "Id of one of its ingredients")
			@RequestParam(required = false) @Nullable Long ingredientId,
			@Parameter(description = "Id of its photo or of its Pinterest photo")
			@RequestParam(required = false) @Nullable UUID imageId,
			@RequestParam(required = false) @Nullable RecipeStatus status,
			@RequestParam(required = false) @Nullable RecipeTheme theme,
			@Parameter(description = "With a publication time (a scheduled draft, or a failed one), or without")
			@RequestParam(required = false) @Nullable Boolean scheduled,
			@ParameterObject @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		return PageResponse.of(recipeService.searchAll(
				new RecipeFilter(q, null, category, tag, List.of(), ingredientId, imageId, status, theme, null, null, scheduled),
				pageable));
	}

	@Operation(summary = "\"Publier maintenant\": a draft or a failed recipe published at once, its schedule dropped",
			description = "Featured ahead, it becomes the featured recipe of its theme. Subscribers are notified of a first "
					+ "publication. Nothing changes for a recipe already published.")
	@PostMapping("/{id}/publish")
	RecipeDetail publishRecipe(@PathVariable long id) {
		return recipeService.publishNow(id);
	}

	@Operation(summary = "A recipe, for the edit form")
	@GetMapping("/{id}")
	RecipeDetail getRecipe(@PathVariable long id) {
		return recipeService.get(id);
	}

	@Operation(summary = "Create a recipe",
			description = "Featuring a published recipe unfeatures the previous one of its theme; a scheduled one is featured "
					+ "once published. Unknown ingredients are created.")
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

	@Operation(summary = "Preview a recipe as it would be saved, without saving anything",
			description = "Same checks as a save. id: the recipe being edited, absent for a new one.")
	@PostMapping("/preview")
	RecipeDetail previewRecipe(@RequestParam(required = false) @Nullable Long id, @Valid @RequestBody RecipeForm form) {
		return recipeService.preview(id, form);
	}

	@Operation(summary = "Duplicate a recipe: a draft titled \"… (copie)\", same content, photos, categories and tags")
	@PostMapping("/{id}/duplicate")
	@ResponseStatus(HttpStatus.CREATED)
	RecipeDetail duplicateRecipe(@PathVariable long id) {
		return recipeService.duplicate(id);
	}

	@Operation(summary = "Move several recipes to the trash, all or none; their photos stay in the gallery")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteRecipes(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids) {
		recipeService.deleteAll(ids);
	}

	@Operation(summary = "Move a recipe to the trash, kept 30 days; its photo stays in the gallery")
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

	@Operation(summary = "Show an image of the gallery on a recipe, or none (default visual)",
			description = "Landscape images only: a Pinterest photo is refused.")
	@PutMapping("/{id}/image-choice")
	RecipeDetail chooseRecipeImage(@PathVariable long id, @RequestBody ImageChoice choice) {
		return recipeService.chooseImage(id, choice.imageId());
	}

	@Operation(summary = "Upload the vertical photo offered to Pinterest; the previous one stays in the gallery",
			description = "JPEG or PNG, 10 MB max, portrait: at least 1000 × 1333 px and 3:4 (2:3 advised).")
	@PutMapping(path = "/{id}/pinterest-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	RecipeDetail replaceRecipePinterestImage(@PathVariable long id, @RequestPart MultipartFile file) {
		return recipeService.replacePinterestImage(id, imageProcessor.processPortrait(file));
	}

	@Operation(summary = "Offer a Pinterest photo of the gallery, or none (the main photo is then offered)")
	@PutMapping("/{id}/pinterest-image-choice")
	RecipeDetail chooseRecipePinterestImage(@PathVariable long id, @RequestBody ImageChoice choice) {
		return recipeService.choosePinterestImage(id, choice.imageId());
	}

}
