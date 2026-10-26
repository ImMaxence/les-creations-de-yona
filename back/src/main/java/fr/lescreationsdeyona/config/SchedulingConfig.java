package fr.lescreationsdeyona.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Periodic clean-up of abandoned restores (RestoreService). */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class SchedulingConfig {
}
