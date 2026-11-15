package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountSignIn.Outcome;
import fr.lescreationsdeyona.security.AccountSignIn.ProviderAccount;
import fr.lescreationsdeyona.security.AccountSignIn.Refusal;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * The way through Google or Microsoft. Leaving, the address says why ({@code ?link=1} from "Mon compte",
 * {@code ?access=<token>} with a link, {@code ?choose=1} to pick another Google account); back, the admin
 * is found ({@link AccountSignIn}) and their session replaces the one Spring Security made.
 */
final class OAuthSignIn {

	private OAuthSignIn() {
	}

	/** Leaving: the reason kept in the session, and Google or Microsoft asked to show its accounts when it matters. */
	static final class Departure implements OAuth2AuthorizationRequestResolver {

		private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{1,100}");

		private final DefaultOAuth2AuthorizationRequestResolver delegate;

		Departure(ClientRegistrationRepository registrations, String baseUri) {
			this.delegate = new DefaultOAuth2AuthorizationRequestResolver(registrations, baseUri);
		}

		@Override
		public @Nullable OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
			try {
				return withIntent(request, delegate.resolve(request));
			}
			catch (IllegalArgumentException ex) {
				// Microsoft without its client, or a made-up name: an unknown address like any other (401), not an error
				return null;
			}
		}

		@Override
		public @Nullable OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
			return withIntent(request, delegate.resolve(request, clientRegistrationId));
		}

		private static @Nullable OAuth2AuthorizationRequest withIntent(HttpServletRequest request,
				@Nullable OAuth2AuthorizationRequest authorization) {
			if (authorization == null) {
				return null;
			}
			SignInIntent intent = intentOf(request);
			SignInIntent.remember(request, intent);
			if (intent == null && request.getParameter("choose") == null) {
				return authorization;
			}
			// Linking or coming in with a link: the account chosen, not the one the browser is signed in with
			Map<String, Object> parameters = new HashMap<>(authorization.getAdditionalParameters());
			parameters.put("prompt", "select_account");
			return OAuth2AuthorizationRequest.from(authorization).additionalParameters(parameters).build();
		}

		private static @Nullable SignInIntent intentOf(HttpServletRequest request) {
			String token = request.getParameter("access");
			// The token of a link is base64url: anything else is kept out of the session and of the address back
			if (token != null && TOKEN.matcher(token).matches()) {
				return new SignInIntent.Access(token);
			}
			if ("1".equals(request.getParameter("link"))) {
				return AdminAuthentication.current().<SignInIntent>map(admin -> new SignInIntent.Link(admin.id())).orElse(null);
			}
			return null;
		}

	}

	/** Back from Google or Microsoft, with an account there (or without: cancelled, expired). */
	static final class Arrival implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

		private final AccountSignIn signIn;

		private final AdminAccounts accounts;

		private final RedirectStrategy redirect = new DefaultRedirectStrategy();

		private final SecurityContextLogoutHandler endSession = new SecurityContextLogoutHandler();

		Arrival(AccountSignIn signIn, AdminAccounts accounts) {
			this.signIn = signIn;
			this.accounts = accounts;
		}

		@Override
		public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
				throws IOException {
			SignInIntent intent = SignInIntent.take(request);
			OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
			IdentityProvider provider = IdentityProvider.of(token.getAuthorizedClientRegistrationId());
			if (provider == null || !(token.getPrincipal() instanceof OidcUser user)) {
				refuse(request, response, intent, Refusal.UNKNOWN);
				return;
			}
			Outcome outcome = signIn.withProvider(providerAccount(provider, user), intent);
			switch (outcome) {
				case Outcome.SignedIn signedIn -> {
					signIn.start(signedIn.account(), request, response);
					redirect.sendRedirect(request, response, signedIn.landing());
				}
				case Outcome.Refused refused -> refuse(request, response, intent, refused.refusal());
			}
		}

		@Override
		public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
				throws IOException {
			refuse(request, response, SignInIntent.take(request), Refusal.CANCELLED);
		}

		/**
		 * Linking from "Mon compte": still signed in, back there. With a link: back to its page. Otherwise
		 * the session ends (an earlier admin's in the same browser too) and the page says why.
		 */
		private void refuse(HttpServletRequest request, HttpServletResponse response, @Nullable SignInIntent intent, Refusal refusal)
				throws IOException {
			if (intent instanceof SignInIntent.Link link) {
				var account = accounts.find(link.accountId()).filter(found -> found.status() == AccountStatus.ACTIVE);
				if (account.isPresent()) {
					signIn.keep(account.get(), request, response);
					redirect.sendRedirect(request, response, "/admin/mon-compte?erreur=" + refusal.slug());
					return;
				}
			}
			endSession.logout(request, response, null);
			if (intent instanceof SignInIntent.Access access && refusal != Refusal.LINK_EXPIRED) {
				redirect.sendRedirect(request, response, UriComponentsBuilder.fromPath("/admin/acces/{token}")
					.queryParam("erreur", refusal.slug())
					.buildAndExpand(access.token())
					.encode()
					.toUriString());
				return;
			}
			redirect.sendRedirect(request, response, "/admin/acces-refuse?raison=" + refusal.slug());
		}

		static ProviderAccount providerAccount(IdentityProvider provider, OidcUser user) {
			// Microsoft gives the address of a personal account as its username, not always as "email"
			String email = user.getEmail() != null ? user.getEmail() : user.getClaimAsString(StandardClaimNames.PREFERRED_USERNAME);
			return new ProviderAccount(provider, user.getSubject(), email, Boolean.TRUE.equals(user.getEmailVerified()), user.getFullName(),
					provider == IdentityProvider.GOOGLE ? user.getPicture() : null);
		}

	}

}
