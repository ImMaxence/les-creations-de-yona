package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.nutrition.NutritionService;
import fr.lescreationsdeyona.nutrition.RecipeNutrition;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The nutrition facts per serving of the published recipes whose page shows them (complete, with servings): said on
 * their cards, and filtered by the recipes page. Computed for all of them at once and kept with the public answers,
 * forgotten after any change of the back-office (an ingredient linked, a new Ciqual table…).
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
class PublishedNutrition {

	private final RecipeRepository recipeRepository;

	private final RecipeMapper recipeMapper;

	private final NutritionService nutritionService;

	/** By recipe id. */
	@Cacheable(PublicCache.RECIPE_NUTRITION)
	public Map<Long, RecipeCard.Nutrition> perServing() {
		Map<Long, RecipeCard.Nutrition> found = new HashMap<>();
		for (Recipe recipe : recipeRepository.findByShowNutritionTrueAndStatus(RecipeStatus.PUBLISHED)) {
			RecipeDetail unfolded = LinkedRecipes.unfold(recipe, recipeMapper.toDetail(recipe), recipeMapper);
			RecipeNutrition nutrition = nutritionService.compute(RecipeService.nutritionLines(unfolded, BigDecimal.ONE),
					unfolded.servings(), unfolded.cookedGrams(), unfolded.nutriScoreKind());
			if (nutrition.complete() && nutrition.perServing() != null) {
				found.put(recipe.getId(), RecipeCard.Nutrition.of(nutrition));
			}
		}
		return Map.copyOf(found);
	}

}
