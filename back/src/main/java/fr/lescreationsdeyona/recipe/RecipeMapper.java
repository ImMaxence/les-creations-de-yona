package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.category.CategoryMapper;
import fr.lescreationsdeyona.common.CentralMapperConfig;
import java.util.List;
import fr.lescreationsdeyona.tag.TagMapper;
import org.jspecify.annotations.Nullable;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(config = CentralMapperConfig.class, uses = { CategoryMapper.class, TagMapper.class })
public interface RecipeMapper {

	@Mapping(target = "imageId", source = "image.id")
	RecipeCard toCard(Recipe recipe);

	@Mapping(target = "categorySlug", source = "mainCategory.slug")
	RecipeSuggestion toSuggestion(Recipe recipe);

	@Mapping(target = "imageId", source = "image.id")
	RecipeAdminSummary toAdminSummary(Recipe recipe);

	@Mapping(target = "imageId", source = "image.id")
	@Mapping(target = "pinterestImageId", source = "pinterestImage.id")
	@Mapping(target = "mold", source = ".")
	@Mapping(target = "equipment", source = "equipment", qualifiedByName = "lines")
	RecipeDetail toDetail(Recipe recipe);

	RecipeDetail.Part toPart(RecipePart part);

	@Mapping(target = "name", source = "ingredient.name")
	RecipeDetail.IngredientLine toIngredientLine(RecipeIngredient line);

	RecipeDetail.Step toStep(RecipeStep step);

	/** The equipment, stored one item per line. */
	@Named("lines")
	default List<String> lines(@Nullable String text) {
		return text == null ? List.of() : text.lines().filter(line -> !line.isBlank()).toList();
	}

	/** Three columns of the recipe, all set or all empty (checked by the database). */
	default RecipeDetail.@Nullable Mold toMold(Recipe recipe) {
		return recipe.getMoldShape() == null ? null
				: new RecipeDetail.Mold(recipe.getMoldShape(), recipe.getMoldLengthCm(), recipe.getMoldWidthCm());
	}

}
