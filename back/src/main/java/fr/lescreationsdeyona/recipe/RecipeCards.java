package fr.lescreationsdeyona.recipe;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** The card of a recipe, with its nutrition facts per serving when its page shows them: for every grid of cards. */
@Component
@RequiredArgsConstructor
public class RecipeCards {

	private final RecipeMapper recipeMapper;

	private final PublishedNutrition publishedNutrition;

	public RecipeCard of(Recipe recipe) {
		return RecipeCard.withNutrition(recipeMapper.toCard(recipe), publishedNutrition.perServing().get(recipe.getId()));
	}

}
