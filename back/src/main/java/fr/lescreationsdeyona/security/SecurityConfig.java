package fr.lescreationsdeyona.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.savedrequest.NullRequestCache;

/**
 * Public read-only API, back-office API restricted to the admins, everything else denied. The
 * only public writes need no account: the subscriptions to notifications, the views of the recipes
 * and the visits of AI assistants, the feedback and the orders of the shop (both behind a captcha),
 * and the steps of a sign-in with a passkey or a link.
 * <p>
 * Sign-in: the Angular back-office sends the browser to {@code /api/oauth2/authorization/google} (or
 * {@code microsoft}), then {@link OAuthSignIn} lands the admin on {@code /admin}, or on
 * {@code /admin/acces-refuse} if refused; or it signs in with a passkey ({@link SignInController}).
 * Either way the session holds an {@link AdminAuthentication}, checked against the account at each
 * request ({@link AdminAccountFilter}).
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

	static final String NOTIFICATION_SUBSCRIPTIONS = "/api/notifications/subscriptions";

	static final String RECIPE_VIEWS = "/api/recipes/*/views";

	/** Visits coming from an AI assistant (Statistiques). */
	static final String AI_VISITS = "/api/ai-visits/*";

	/** "Donner mon avis": sent by visitors, who have no CSRF token. */
	static final String FEEDBACK = "/api/feedback";

	/** An error of a visitor's browser, for the error log of the back-office (Journaux). */
	static final String BROWSER_ERRORS = "/api/browser-errors";

	/** An order of the shop: sent by visitors, who have no CSRF token. */
	static final String SHOP_ORDERS = "/api/shop/orders";

	/**
	 * Signing in with a passkey, or making one with a link: before any session, so without a CSRF token.
	 * A forged request gets nowhere: the answer is signed by the passkey, over a challenge of the session.
	 */
	static final String[] SIGN_IN_STEPS = { "/api/auth/passkey", "/api/auth/passkey/options", "/api/auth/access-links/*/passkey",
			"/api/auth/access-links/*/passkey/options" };

	/** What anyone may read: the site's pages and their data. Checked against the controllers by EndpointAccessTest. */
	static final String[] PUBLIC_READS = { "/api/recipes/**", "/api/featured-recipe", "/api/search-suggestions", "/api/menus",
			"/api/menus/*", "/api/ingredients", "/api/ingredients/aisles", "/api/site-content", "/api/categories/**", "/api/tags",
			"/api/social-links/**", "/api/images/**", "/api/theme", "/api/glossary", "/api/notifications/public-key",
			"/api/feedback/captcha", "/api/cap/**", "/api/shop", "/api/shop/orders/*", "/api/site-sections", "/api/auth/methods",
			"/api/auth/access-links/*" };

	private static final String AUTHORIZATION_BASE_URI = "/api/oauth2/authorization";

	/** The admin of the request, read from the session; kept in the request too for its asynchronous dispatches. */
	@Bean
	SecurityContextRepository securityContextRepository() {
		return new DelegatingSecurityContextRepository(new RequestAttributeSecurityContextRepository(),
				new HttpSessionSecurityContextRepository());
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, ClientRegistrationRepository registrations, AccountSignIn signIn,
			AdminAccounts accounts, SecurityContextRepository contextRepository, ProblemDetailSecurityHandler problemDetailSecurityHandler,
			@Value("${springdoc.api-docs.enabled}") boolean apiDocsEnabled) {
		OAuthSignIn.Arrival arrival = new OAuthSignIn.Arrival(signIn, accounts);
		http.authorizeHttpRequests(requests -> {
			requests.requestMatchers("/api/admin/**").hasRole(AdminAuthentication.ADMIN_ROLE)
				.requestMatchers(HttpMethod.GET, PUBLIC_READS)
				.permitAll()
				.requestMatchers(HttpMethod.POST, NOTIFICATION_SUBSCRIPTIONS).permitAll()
				.requestMatchers(HttpMethod.DELETE, NOTIFICATION_SUBSCRIPTIONS).permitAll()
				.requestMatchers(HttpMethod.POST, RECIPE_VIEWS, AI_VISITS, BROWSER_ERRORS).permitAll()
				.requestMatchers(HttpMethod.POST, FEEDBACK, SHOP_ORDERS).permitAll()
				.requestMatchers(HttpMethod.POST, SIGN_IN_STEPS).permitAll()
				.requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll();
			// Local runs only: in production the documentation is off and its URLs are denied like any other.
			if (apiDocsEnabled) {
				requests.requestMatchers(HttpMethod.GET, "/api/docs/**").permitAll();
			}
			requests.requestMatchers("/error").permitAll().anyRequest().denyAll();
		})
			.securityContext(context -> context.securityContextRepository(contextRepository))
			.oauth2Login(login -> login
				.authorizationEndpoint(endpoint -> endpoint.baseUri(AUTHORIZATION_BASE_URI)
					.authorizationRequestResolver(new OAuthSignIn.Departure(registrations, AUTHORIZATION_BASE_URI)))
				.redirectionEndpoint(endpoint -> endpoint.baseUri("/api/login/oauth2/code/*"))
				.successHandler(arrival)
				.failureHandler(arrival))
			.addFilterBefore(new AdminAccountFilter(accounts, contextRepository), AuthorizationFilter.class)
			.logout(logout -> logout
				.logoutUrl("/api/auth/logout")
				.deleteCookies("JSESSIONID")
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
			// XSRF-TOKEN cookie, sent back by Angular's HttpClient in the X-XSRF-TOKEN header. The token is
			// deferred: only the back-office creates it (GET /api/admin/me), public visitors never get it.
			// Visitors have no CSRF token. Forging a request could only subscribe a push service address or
			// remove one, count a view or a visit, report an error (limited), send what the captcha stops, or
			// start a passkey sign-in that only the passkey can finish, which grants nothing.
			.csrf(csrf -> csrf
				.ignoringRequestMatchers(NOTIFICATION_SUBSCRIPTIONS, RECIPE_VIEWS, AI_VISITS, BROWSER_ERRORS, FEEDBACK, SHOP_ORDERS)
				.ignoringRequestMatchers(SIGN_IN_STEPS)
				.csrfTokenRepository(csrfTokenRepository())
				.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
			// Sign-in always lands on a page of its own: no need to remember the request, nor to open a session for it.
			.requestCache(cache -> cache.requestCache(new NullRequestCache()))
			.exceptionHandling(exceptions -> exceptions
				.authenticationEntryPoint(problemDetailSecurityHandler)
				.accessDeniedHandler(problemDetailSecurityHandler));
		return http.build();
	}

	/** Readable by Angular (not HttpOnly), so it must not leave the site: Secure and SameSite=Strict. */
	private static CookieCsrfTokenRepository csrfTokenRepository() {
		CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
		repository.setCookieCustomizer(cookie -> cookie.secure(true).sameSite("Strict"));
		return repository;
	}

}
