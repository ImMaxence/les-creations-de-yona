package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Recipes")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
class RecipeController {

	private final RecipeService recipeService;

	@Operation(summary = "Published recipes, filtered by title and category",
			description = "Sort on title, createdAt or updatedAt. The home page asks for size=3.")
	@GetMapping("/recipes")
	PageResponse<RecipeCard> listPublishedRecipes(
			@Parameter(description = "Part of the title, case and accents ignored")
			@RequestParam(required = false) @Size(max = 100) @Nullable String q,
			@Parameter(description = "Category slug")
			@RequestParam(required = false) @Nullable String category,
			@Parameter(description = "Part of the name of one of its ingredients, case and accents ignored")
			@RequestParam(required = false) @Size(max = 100) @Nullable String ingredient,
			@ParameterObject @PageableDefault(size = 12, sort = "createdAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		return PageResponse.of(recipeService.searchPublished(q, category, ingredient, pageable));
	}

	@Operation(summary = "Published recipe by slug; 404 for a draft")
	@GetMapping("/recipes/{slug}")
	RecipeDetail getPublishedRecipe(@PathVariable String slug) {
		return recipeService.getPublished(slug);
	}

	// Kept out of /recipes/{...} so that no recipe slug can ever shadow these routes.

	@Operation(summary = "Featured recipe, or the latest published one; 204 when there is no recipe")
	@GetMapping("/featured-recipe")
	ResponseEntity<RecipeCard> getFeaturedRecipe() {
		return recipeService.findFeatured()
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@Operation(summary = "Title autocompletion: at most 5 published recipes")
	@GetMapping("/recipe-suggestions")
	List<RecipeSuggestion> suggestRecipeTitles(@RequestParam @NotBlank @Size(min = 2, max = 100) String q) {
		return recipeService.suggestTitles(q);
	}

}
