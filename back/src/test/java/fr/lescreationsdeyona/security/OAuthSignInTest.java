package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

class OAuthSignInTest {

	private final ClientRegistrationRepository registrations = new ClientRegistrations().clientRegistrationRepository(
			new AuthProperties(new AuthProperties.Provider("google-id", "google-secret"), new AuthProperties.Provider("ms-id", "ms-secret"),
					List.of()));

	private final OAuthSignIn.Departure departure = new OAuthSignIn.Departure(registrations, "/api/oauth2/authorization");

	@AfterEach
	void clear() {
		SecurityContextHolder.clearContext();
	}

	private static MockHttpServletRequest leavingFor(String provider) {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/oauth2/authorization/" + provider);
		request.setServletPath("/api/oauth2/authorization/" + provider);
		return request;
	}

	@Test
	void leavesForAPlainSignInWithoutReason() {
		MockHttpServletRequest request = leavingFor("google");
		request.getSession(true).setAttribute(SignInIntent.ATTRIBUTE, new SignInIntent.Link(9));

		OAuth2AuthorizationRequest authorization = departure.resolve(request);

		assertThat(authorization).isNotNull();
		assertThat(authorization.getAdditionalParameters()).doesNotContainKey("prompt");
		// A link started and left halfway is forgotten
		assertThat(SignInIntent.take(request)).isNull();
	}

	@Test
	void remembersTheLinkOfAnInvitationAndAsksWhichAccount() {
		MockHttpServletRequest request = leavingFor("microsoft");
		request.setParameter("access", "token-123");

		OAuth2AuthorizationRequest authorization = departure.resolve(request);

		assertThat(authorization.getAdditionalParameters()).containsEntry("prompt", "select_account");
		assertThat(authorization.getAuthorizationUri()).startsWith("https://login.microsoftonline.com/consumers/");
		assertThat(SignInIntent.take(request)).isEqualTo(new SignInIntent.Access("token-123"));
	}

	@Test
	void keepsATokenThatIsNoneOutOfTheSession() {
		MockHttpServletRequest request = leavingFor("google");
		request.setParameter("access", "x/../../..//ailleurs.com");

		departure.resolve(request);

		assertThat(SignInIntent.take(request)).isNull();
	}

	@Test
	void answersAnUnknownProviderLikeAnyUnknownAddress() {
		OAuthSignIn.Departure googleOnly = new OAuthSignIn.Departure(new ClientRegistrations().clientRegistrationRepository(
				new AuthProperties(new AuthProperties.Provider("google-id", "google-secret"), null, List.of())), "/api/oauth2/authorization");

		// Not an error: nothing to resolve, the request goes on to be refused (401)
		assertThat(googleOnly.resolve(leavingFor("microsoft"))).isNull();
		assertThat(googleOnly.resolve(leavingFor("nimportequoi"))).isNull();
	}

	@Test
	void linksToTheAdminSignedInOnly() {
		MockHttpServletRequest request = leavingFor("google");
		request.setParameter("link", "1");
		departure.resolve(request);
		assertThat(SignInIntent.take(request)).as("nobody signed in").isNull();

		SecurityContextHolder.getContext()
			.setAuthentication(AdminAuthentication.of(new Account(4, "yona@example.fr", "Yona", AccountStatus.ACTIVE, 0, null, Instant.EPOCH,
					null, null, null)));
		departure.resolve(request);

		assertThat(SignInIntent.take(request)).isEqualTo(new SignInIntent.Link(4));
	}

	@Test
	void readsTheAddressOfAPersonalMicrosoftAccountFromItsUsername() {
		OidcIdToken token = OidcIdToken.withTokenValue("token")
			.subject("ms-sub")
			.claim(StandardClaimNames.PREFERRED_USERNAME, "yona@outlook.fr")
			.claim(StandardClaimNames.NAME, "Yona")
			.issuedAt(Instant.now())
			.expiresAt(Instant.now().plusSeconds(60))
			.build();

		AccountSignIn.ProviderAccount who = OAuthSignIn.Arrival.providerAccount(IdentityProvider.MICROSOFT,
				new DefaultOidcUser(List.of(), token));

		assertThat(who).isEqualTo(new AccountSignIn.ProviderAccount(IdentityProvider.MICROSOFT, "ms-sub", "yona@outlook.fr", false, "Yona", null));
	}

	@Test
	void offersMicrosoftOnlyWhenItsClientIsSet() {
		ClientRegistrationRepository googleOnly = new ClientRegistrations()
			.clientRegistrationRepository(new AuthProperties(new AuthProperties.Provider("id", "secret"), null, List.of()));

		assertThat(googleOnly.findByRegistrationId("google")).isNotNull();
		assertThat(googleOnly.findByRegistrationId("microsoft")).isNull();
		ClientRegistration microsoft = registrations.findByRegistrationId("microsoft");
		assertThat(microsoft.getProviderDetails().getIssuerUri())
			.isEqualTo("https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0");
		assertThat(microsoft.getRedirectUri()).isEqualTo("{baseUrl}/api/login/oauth2/code/{registrationId}");
	}

}
