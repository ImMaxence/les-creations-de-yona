package fr.lescreationsdeyona.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Fills {@code @CreatedDate}/{@code @LastModifiedDate}, and {@code @CreatedBy}/{@code @LastModifiedBy}
 * with the admin email given by the {@code AuditorAware} bean.
 */
@Configuration(proxyBeanMethods = false)
@EnableJpaAuditing
class JpaAuditingConfig {
}
