package fr.lescreationsdeyona.live;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * The WebSocket of the back-office. Under {@code /api/admin}: SecurityConfig lets only the admins
 * open it, with their session cookie. Same origin only (Spring's default): another site cannot open
 * it in an admin's browser.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSocket
class LiveConfig implements WebSocketConfigurer {

	private final AdminLive adminLive;

	LiveConfig(AdminLive adminLive) {
		this.adminLive = adminLive;
	}

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		registry.addHandler(adminLive, AdminLive.PATH);
	}

}
