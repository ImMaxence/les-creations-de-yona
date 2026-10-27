package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.search.SearchMissService;
import fr.lescreationsdeyona.security.Admins;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Recipes")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
class RecipeController {

	/** "Qu'est-ce que je peux faire avec…": ingredients combined in one search, at most. */
	static final int MAX_INGREDIENTS = 5;

	private final RecipeService recipeService;

	private final SearchMissService searchMissService;

	@Operation(summary = "Published recipes, filtered by title, category, tag, ingredient, time and difficulty",
			description = "Sort on title, createdAt, updatedAt or publishedAt (default: the last published first). "
					+ "The home page asks for size=3. A search by title "
					+ "that finds nothing is noted, anonymously, for the back-office statistics.")
	@GetMapping("/recipes")
	PageResponse<RecipeCard> listPublishedRecipes(
			@Parameter(description = "Part of the title, case and accents ignored")
			@RequestParam(required = false) @Size(max = 100) @Nullable String q,
			@Parameter(description = "Category slug")
			@RequestParam(required = false) @Nullable String category,
			@Parameter(description = "Tag slug")
			@RequestParam(required = false) @Nullable String tag,
			@Parameter(description = "Names of ingredients it must all have (GET /api/ingredients), case and accents "
					+ "ignored; repeated for several, " + MAX_INGREDIENTS + " at most")
			@RequestParam(required = false) @Size(max = MAX_INGREDIENTS) @Nullable List<@Size(max = 100) String> ingredient,
			@Parameter(description = "Preparation, rest and cooking together at most this long, in minutes")
			@RequestParam(required = false) @Min(1) @Max(1440) @Nullable Integer maxMinutes,
			@RequestParam(required = false) @Nullable DifficultyLevel difficulty,
			@ParameterObject @PageableDefault(size = 12, sort = "publishedAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		Page<RecipeCard> recipes = recipeService.searchPublished(
				new RecipeFilter(q, category, tag, ingredient == null ? List.of() : ingredient, null, null, null,
						maxMinutes, difficulty), pageable);
		if (recipes.isEmpty() && pageable.getPageNumber() == 0 && StringUtils.hasText(q)) {
			searchMissService.record(q);
		}
		return PageResponse.of(recipes);
	}

	@Operation(summary = "Published recipe by slug; 404 for a draft")
	@GetMapping("/recipes/{slug}")
	RecipeDetail getPublishedRecipe(@PathVariable String slug) {
		return recipeService.getPublished(slug);
	}

	@Operation(summary = "A visit of a published recipe page, sent once per visit by the browser",
			description = "Counts one view; nothing about the visitor is kept. The admins' own visits, and drafts, "
					+ "are not counted. No CSRF token: visitors have none.")
	@PostMapping("/recipes/{slug}/views")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void recordRecipeView(@PathVariable @Size(max = 200) String slug, @Nullable Authentication authentication) {
		if (!Admins.isAdmin(authentication)) {
			recipeService.recordView(slug);
		}
	}

	@Operation(summary = "\"Vous aimerez aussi\": 3 published recipes sharing its tags or categories, else the latest")
	@GetMapping("/recipes/{slug}/related")
	List<RecipeCard> listRelatedRecipes(@PathVariable String slug) {
		return recipeService.related(slug);
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
