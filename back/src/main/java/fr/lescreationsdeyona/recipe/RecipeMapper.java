package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryMapper;
import fr.lescreationsdeyona.common.CentralMapperConfig;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = CentralMapperConfig.class, uses = CategoryMapper.class)
public interface RecipeMapper {

	@Mapping(target = "imageId", source = "image.id")
	RecipeCard toCard(Recipe recipe);

	@Mapping(target = "categorySlug", source = "category.slug")
	RecipeSuggestion toSuggestion(Recipe recipe);

	RecipeAdminSummary toAdminSummary(Recipe recipe);

	@Mapping(target = "imageId", source = "image.id")
	RecipeDetail toDetail(Recipe recipe);

	@Mapping(target = "name", source = "ingredient.name")
	RecipeDetail.IngredientLine toIngredientLine(RecipeIngredient line);

	RecipeDetail.Step toStep(RecipeStep step);

}
