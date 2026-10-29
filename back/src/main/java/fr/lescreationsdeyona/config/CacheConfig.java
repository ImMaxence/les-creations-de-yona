package fr.lescreationsdeyona.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Memory given to speed (see common/PublicCache): 500 answers at most in each cache, a few
 * megabytes in all for a blog, each forgotten after 10 minutes at the latest.
 */
@Configuration(proxyBeanMethods = false)
@EnableCaching
class CacheConfig {

	static final Duration EXPIRY = Duration.ofMinutes(10);

	static final int MAX_ENTRIES = 500;

	@Bean
	CacheManager cacheManager() {
		CaffeineCacheManager manager = new CaffeineCacheManager();
		manager.setCaffeine(Caffeine.newBuilder().maximumSize(MAX_ENTRIES).expireAfterWrite(EXPIRY));
		return manager;
	}

}
