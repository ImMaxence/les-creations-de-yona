package fr.lescreationsdeyona.live;

import java.net.URI;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.WebUtils;

/**
 * The WebSocket of the back-office. Under {@code /api/admin}: SecurityConfig lets only the admins
 * open it, with their session cookie. Another site cannot open it in an admin's browser: the page
 * must come from the same address as the request (Spring's check), or from the site's public address
 * ({@code app.site-url}), should the proxies in front tell the backend another one. A page refused is
 * said in "Journaux", with both addresses.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocket
class LiveConfig implements WebSocketConfigurer {

	private static final Logger log = LoggerFactory.getLogger(LiveConfig.class);

	private final AdminLive adminLive;

	private final URI site;

	LiveConfig(AdminLive adminLive, @Value("${app.site-url}") URI site) {
		this.adminLive = adminLive;
		this.site = site;
	}

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		// The origin is checked below (SameSite) in place of Spring's own check, which says nothing when it refuses
		registry.addHandler(adminLive, AdminLive.PATH).setAllowedOriginPatterns("*").addInterceptors(new SameSite(site));
	}

	/** The page of the back-office only: same address as the request, or the site's public one. */
	static final class SameSite implements HandshakeInterceptor {

		private final URI site;

		SameSite(URI site) {
			this.site = site;
		}

		@Override
		public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
				Map<String, Object> attributes) {
			String origin = request.getHeaders().getOrigin();
			if (origin == null || WebUtils.isSameOrigin(request) || sameOrigin(origin, site)) {
				return true;
			}
			URI asked = request.getURI();
			log.warn("Live connection refused: the page comes from {}, the request from {}://{}:{}, the site is {}", origin,
					asked.getScheme(), asked.getHost(), asked.getPort(), site);
			response.setStatusCode(HttpStatus.FORBIDDEN);
			return false;
		}

		@Override
		public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
				@Nullable Exception exception) {
			// Nothing to add
		}

		/** Same scheme, host and port (the default one of the scheme when none is written). */
		static boolean sameOrigin(String written, URI site) {
			URI origin;
			try {
				origin = URI.create(written);
			}
			catch (IllegalArgumentException ex) {
				return false;
			}
			return origin.getScheme() != null && origin.getScheme().equalsIgnoreCase(site.getScheme()) && origin.getHost() != null
					&& origin.getHost().equalsIgnoreCase(site.getHost()) && port(origin) == port(site);
		}

		private static int port(URI uri) {
			if (uri.getPort() != -1) {
				return uri.getPort();
			}
			return "https".equalsIgnoreCase(uri.getScheme()) || "wss".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
		}

	}

}
