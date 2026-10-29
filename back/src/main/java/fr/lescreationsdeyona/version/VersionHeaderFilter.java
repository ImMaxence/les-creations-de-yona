package fr.lescreationsdeyona.version;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Every answer of the API says the version of the backend ({@value #HEADER}): a page of the site
 * opened before a deployment, kept by the service worker, learns that a newer version is out and
 * offers it, instead of talking to an API newer than itself. First of the filters, so that refused
 * requests (401, 403) say it too.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
class VersionHeaderFilter extends OncePerRequestFilter {

	static final String HEADER = "X-App-Version";

	private final BackendVersion version;

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith("/api/");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		response.setHeader(HEADER, version.value());
		chain.doFilter(request, response);
	}

}
