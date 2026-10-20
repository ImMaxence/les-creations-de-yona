package fr.lescreationsdeyona.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Fills {@code @CreatedDate} and {@code @LastModifiedDate} fields. {@code @CreatedBy} and
 * {@code @LastModifiedBy} are filled once an {@code AuditorAware} bean provides the admin email.
 */
@Configuration(proxyBeanMethods = false)
@EnableJpaAuditing
class JpaAuditingConfig {
}
