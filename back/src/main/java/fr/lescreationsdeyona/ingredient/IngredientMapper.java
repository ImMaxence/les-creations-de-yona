package fr.lescreationsdeyona.ingredient;

import fr.lescreationsdeyona.common.CentralMapperConfig;
import org.mapstruct.Mapper;

@Mapper(config = CentralMapperConfig.class)
public interface IngredientMapper {

	IngredientResponse toResponse(Ingredient ingredient);

}
