package fr.lescreationsdeyona.tag;

import fr.lescreationsdeyona.common.CentralMapperConfig;
import org.mapstruct.Mapper;

@Mapper(config = CentralMapperConfig.class)
public interface TagMapper {

	TagResponse toResponse(Tag tag);

}
