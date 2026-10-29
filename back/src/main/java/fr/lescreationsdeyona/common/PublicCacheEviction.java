package fr.lescreationsdeyona.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Any write of the back-office (POST, PUT, DELETE under /api/admin) empties the public cache once
 * answered, its transaction committed; a refused one too, which costs nothing but a few reads.
 */
@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
class PublicCacheEviction implements WebMvcConfigurer, HandlerInterceptor {

	private final PublicCache publicCache;

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/admin/**");
	}

	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
			@Nullable Exception ex) {
		if (!"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod())) {
			publicCache.clear();
		}
	}

}
