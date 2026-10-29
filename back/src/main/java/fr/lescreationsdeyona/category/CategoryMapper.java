package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.common.CentralMapperConfig;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = CentralMapperConfig.class)
public interface CategoryMapper {

	@Mapping(target = "imageId", source = "image.id")
	@Mapping(target = "publishedThemes", expression = "java(java.util.List.of())")
	CategoryResponse toResponse(Category category);

}
