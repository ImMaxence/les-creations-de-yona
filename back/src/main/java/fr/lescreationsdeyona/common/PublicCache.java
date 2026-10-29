package fr.lescreationsdeyona.common;

import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

/**
 * What the public API answers, kept in memory (Caffeine, see CacheConfig): the pages rendered by
 * the server ask for the same recipes, categories and texts at each visit. Everything is forgotten
 * at once after any change made in the back-office (PublicCacheEviction), a scheduled publication
 * or a restored backup: no answer is ever older than the last change. Each entry also expires on
 * its own after a few minutes, as a safety net.
 */
@Component
@RequiredArgsConstructor
public class PublicCache {

	public static final String RECIPES = "public-recipes";

	public static final String RECIPE = "public-recipe";

	public static final String RELATED_RECIPES = "public-related-recipes";

	public static final String FEATURED_RECIPE = "public-featured-recipe";

	public static final String SEARCH_SUGGESTIONS = "public-search-suggestions";

	public static final String CATEGORIES = "public-categories";

	public static final String MENUS = "public-menus";

	public static final String MENU = "public-menu";

	public static final String TAGS = "public-tags";

	public static final String GLOSSARY = "public-glossary";

	public static final String INGREDIENTS = "public-ingredients";

	public static final String AISLES = "public-aisles";

	public static final String SOCIAL_LINKS = "public-social-links";

	public static final String SITE_CONTENT = "public-site-content";

	public static final String THEME = "public-theme";

	private final CacheManager cacheManager;

	/** Every answer forgotten: the next visit reads the database again. */
	public void clear() {
		cacheManager.getCacheNames()
			.stream()
			.map(cacheManager::getCache)
			.filter(Objects::nonNull)
			.forEach(cache -> cache.clear());
	}

}
