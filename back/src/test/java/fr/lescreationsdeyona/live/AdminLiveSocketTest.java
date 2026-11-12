package fr.lescreationsdeyona.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.tomcat.autoconfigure.servlet.TomcatServletWebServerAutoConfiguration;
import org.springframework.boot.webmvc.autoconfigure.DispatcherServletAutoConfiguration;
import org.springframework.boot.webmvc.autoconfigure.WebMvcAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * The real time of the back-office in a real server, through Spring Security as in production: each
 * connection is known by the admin signed in (their Google account), so that a group's news and "est
 * en train d'écrire" reach its members only. A test filter signs the admin in, as the Google login would.
 */
@SpringBootTest(classes = AdminLiveSocketTest.App.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "spring.config.import=")
class AdminLiveSocketTest {

	private static final String SIGNED_IN = "X-Test-Admin";

	@SpringBootConfiguration
	@ImportAutoConfiguration({ TomcatServletWebServerAutoConfiguration.class, DispatcherServletAutoConfiguration.class,
			WebMvcAutoConfiguration.class, SecurityAutoConfiguration.class, ServletWebSecurityAutoConfiguration.class,
			SecurityFilterAutoConfiguration.class })
	@EnableWebSecurity
	@Import({ LiveConfig.class, AdminLive.class })
	static class App {

		/** Group 12 holds Yona and Léa. */
		@Bean
		TypingRelay typingRelay() {
			return (group, writer, name) -> group == 12 && Set.of("yona@site.fr", "lea@site.fr").contains(writer)
					? Set.of("yona@site.fr", "lea@site.fr")
					: Set.of();
		}

		@Bean
		SecurityFilterChain chain(HttpSecurity http) {
			return http.authorizeHttpRequests(requests -> requests.anyRequest().hasRole("ADMIN"))
				.addFilterBefore(new GoogleSignIn(), AuthorizationFilter.class)
				.build();
		}

	}

	/** The admin of the header signed in with Google, as the session of a real login holds them. */
	static class GoogleSignIn extends OncePerRequestFilter {

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			String email = request.getHeader(SIGNED_IN);
			if (email != null) {
				OidcIdToken token = OidcIdToken.withTokenValue("token")
					.subject(email)
					.claim(StandardClaimNames.EMAIL, email)
					.claim(StandardClaimNames.NAME, email.substring(0, email.indexOf('@')))
					.issuedAt(Instant.now())
					.expiresAt(Instant.now().plusSeconds(60))
					.build();
				var authorities = AuthorityUtils.createAuthorityList("ROLE_ADMIN");
				SecurityContext context = SecurityContextHolder.createEmptyContext();
				context.setAuthentication(new OAuth2AuthenticationToken(new DefaultOidcUser(authorities, token, StandardClaimNames.EMAIL),
						authorities, "google"));
				SecurityContextHolder.setContext(context);
			}
			chain.doFilter(request, response);
		}

	}

	/** A page of the back-office open for an admin: what it is told. */
	private static final class Page extends TextWebSocketHandler {

		final BlockingQueue<String> told = new LinkedBlockingQueue<>();

		WebSocketSession session;

		@Override
		protected void handleTextMessage(WebSocketSession session, TextMessage message) {
			told.add(message.getPayload());
		}

	}

	@LocalServerPort
	int port;

	@Autowired
	AdminLive live;

	private final List<WebSocketSession> sessions = new java.util.ArrayList<>();

	@AfterEach
	void close() throws IOException {
		for (WebSocketSession session : sessions) {
			session.close();
		}
	}

	private Page open(String email) throws Exception {
		return open(email, null);
	}

	/** {@code origin}: the address of the page opening it, none for a page of the same address. */
	private Page open(String email, String origin) throws Exception {
		Page page = new Page();
		WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
		headers.add(SIGNED_IN, email);
		if (origin != null) {
			headers.setOrigin(origin);
		}
		page.session = new StandardWebSocketClient().execute(page, headers, URI.create("ws://localhost:" + port + AdminLive.PATH))
			.get(5, TimeUnit.SECONDS);
		sessions.add(page.session);
		return page;
	}

	private void awaitConnections(int count) throws InterruptedException {
		for (int i = 0; i < 50 && live.connections() < count; i++) {
			Thread.sleep(20);
		}
		assertThat(live.connections()).isEqualTo(count);
	}

	@Test
	void tellsTheMembersOfAGroupThroughTheirSignedInConnection() throws Exception {
		Page yona = open("Yona@site.fr");
		Page lea = open("lea@site.fr");
		Page outsider = open("autre@site.fr");
		awaitConnections(3);

		live.onChange(new LiveChange(LiveTopic.MESSAGES, Set.of("yona@site.fr", "lea@site.fr")));

		assertThat(yona.told.poll(2, TimeUnit.SECONDS)).isEqualTo("{\"topic\":\"MESSAGES\"}");
		assertThat(lea.told.poll(2, TimeUnit.SECONDS)).isEqualTo("{\"topic\":\"MESSAGES\"}");
		assertThat(outsider.told.poll(300, TimeUnit.MILLISECONDS)).isNull();
	}

	@Test
	void opensForAPageOfTheSitePublicAddressAndRefusesAnotherSite() throws Exception {
		open("yona@site.fr", "https://les-creations-de-yona.fr");
		awaitConnections(1);

		assertThatThrownBy(() -> open("yona@site.fr", "https://pirate.example")).hasRootCauseInstanceOf(Exception.class);
		assertThat(live.connections()).isEqualTo(1);
	}

	@Test
	void readsTheOriginOfAPage() {
		URI site = URI.create("https://les-creations-de-yona.fr");

		assertThat(LiveConfig.SameSite.sameOrigin("https://les-creations-de-yona.fr", site)).isTrue();
		assertThat(LiveConfig.SameSite.sameOrigin("https://LES-CREATIONS-DE-YONA.fr:443", site)).isTrue();
		assertThat(LiveConfig.SameSite.sameOrigin("http://les-creations-de-yona.fr", site)).isFalse();
		assertThat(LiveConfig.SameSite.sameOrigin("https://les-creations-de-yona.fr.pirate.example", site)).isFalse();
		assertThat(LiveConfig.SameSite.sameOrigin("pas une adresse", site)).isFalse();
	}

	@Test
	void tellsTheOtherMembersWhoIsWriting() throws Exception {
		Page yona = open("yona@site.fr");
		Page lea = open("lea@site.fr");
		awaitConnections(2);

		yona.session.sendMessage(new TextMessage("{\"typing\":12}"));

		assertThat(lea.told.poll(2, TimeUnit.SECONDS)).isEqualTo("{\"topic\":\"TYPING\",\"group\":12,\"email\":\"yona@site.fr\",\"name\":\"yona\"}");
		assertThat(yona.told.poll(300, TimeUnit.MILLISECONDS)).isNull();
	}

}
