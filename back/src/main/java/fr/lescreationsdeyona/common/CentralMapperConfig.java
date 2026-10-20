package fr.lescreationsdeyona.common;

import org.mapstruct.InjectionStrategy;
import org.mapstruct.MapperConfig;
import org.mapstruct.MappingConstants;
import org.mapstruct.ReportingPolicy;

/** Shared by every mapper: Spring beans, and a compile error when a DTO field is left unmapped. */
@MapperConfig(componentModel = MappingConstants.ComponentModel.SPRING,
		injectionStrategy = InjectionStrategy.CONSTRUCTOR, unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CentralMapperConfig {
}
