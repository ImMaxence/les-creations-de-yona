package fr.lescreationsdeyona.social;

import fr.lescreationsdeyona.common.CentralMapperConfig;
import org.mapstruct.Mapper;

@Mapper(config = CentralMapperConfig.class)
public interface SocialLinkMapper {

	SocialLinkResponse toResponse(SocialLink socialLink);

}
