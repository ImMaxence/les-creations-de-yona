package fr.lescreationsdeyona.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.savedrequest.NullRequestCache;

/**
 * Public read-only API, back-office API restricted to the admins, everything else denied.
 * <p>
 * Login flow: the Angular back-office sends the browser to {@code /api/oauth2/authorization/google};
 * after Google, the admin lands on {@code /admin}, or on {@code /admin/acces-refuse} if refused.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AdminOidcUserService adminOidcUserService,
			ProblemDetailSecurityHandler problemDetailSecurityHandler,
			@Value("${springdoc.api-docs.enabled}") boolean apiDocsEnabled) {
		http.authorizeHttpRequests(requests -> {
			requests.requestMatchers("/api/admin/**").hasRole(AdminOidcUserService.ADMIN_ROLE)
				.requestMatchers(HttpMethod.GET, "/api/recipes/**", "/api/featured-recipe", "/api/recipe-suggestions",
						"/api/ingredients", "/api/site-content", "/api/categories/**", "/api/social-links/**", "/api/images/**", "/api/theme")
				.permitAll()
				.requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll();
			// Local runs only: in production the documentation is off and its URLs are denied like any other.
			if (apiDocsEnabled) {
				requests.requestMatchers(HttpMethod.GET, "/api/docs/**").permitAll();
			}
			requests.requestMatchers("/error").permitAll().anyRequest().denyAll();
		})
			.oauth2Login(login -> login
				.authorizationEndpoint(endpoint -> endpoint.baseUri("/api/oauth2/authorization"))
				.redirectionEndpoint(endpoint -> endpoint.baseUri("/api/login/oauth2/code/*"))
				.userInfoEndpoint(endpoint -> endpoint.oidcUserService(adminOidcUserService))
				.defaultSuccessUrl("/admin", true)
				.failureHandler(endSessionAndRedirectTo("/admin/acces-refuse")))
			.logout(logout -> logout
				.logoutUrl("/api/auth/logout")
				.deleteCookies("JSESSIONID")
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
			// XSRF-TOKEN cookie, sent back by Angular's HttpClient in the X-XSRF-TOKEN header. The token is
			// deferred: only the back-office creates it (GET /api/admin/me), public visitors never get it.
			.csrf(csrf -> csrf
				.csrfTokenRepository(csrfTokenRepository())
				.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
			// Login always lands on /admin: no need to remember the request, nor to open a session for it.
			.requestCache(cache -> cache.requestCache(new NullRequestCache()))
			.exceptionHandling(exceptions -> exceptions
				.authenticationEntryPoint(problemDetailSecurityHandler)
				.accessDeniedHandler(problemDetailSecurityHandler));
		return http.build();
	}

	/** A refused login also ends the session of an earlier admin login in the same browser. */
	private static AuthenticationFailureHandler endSessionAndRedirectTo(String url) {
		SecurityContextLogoutHandler endSession = new SecurityContextLogoutHandler();
		RedirectStrategy redirect = new DefaultRedirectStrategy();
		return (request, response, exception) -> {
			endSession.logout(request, response, null);
			redirect.sendRedirect(request, response, url);
		};
	}

	/** Readable by Angular (not HttpOnly), so it must not leave the site: Secure and SameSite=Strict. */
	private static CookieCsrfTokenRepository csrfTokenRepository() {
		CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
		repository.setCookieCustomizer(cookie -> cookie.secure(true).sameSite("Strict"));
		return repository;
	}

}
