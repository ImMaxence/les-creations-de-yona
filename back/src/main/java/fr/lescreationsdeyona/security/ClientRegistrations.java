package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;

/**
 * Google, and Microsoft when its client is set. Their addresses are written here rather than read from
 * them at start-up (OpenID discovery): the site starts even if one of them is down.
 */
@Configuration(proxyBeanMethods = false)
class ClientRegistrations {

	/** Kept under /api so the reverse proxy routes it to the backend. */
	static final String REDIRECT_URI = "{baseUrl}/api/login/oauth2/code/{registrationId}";

	/**
	 * Personal Microsoft accounts (Outlook, Hotmail, Live, Xbox): the "consumers" tenant. Its tokens are
	 * issued by this fixed tenant, which the id token is checked against.
	 */
	private static final String MICROSOFT = "https://login.microsoftonline.com/consumers";

	private static final String MICROSOFT_ISSUER = "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0";

	@Bean
	ClientRegistrationRepository clientRegistrationRepository(AuthProperties properties) {
		List<ClientRegistration> registrations = new ArrayList<>();
		registrations.add(CommonOAuth2Provider.GOOGLE.getBuilder(IdentityProvider.GOOGLE.registrationId())
			.clientId(properties.google().clientId())
			.clientSecret(properties.google().clientSecret())
			.scope("openid", "email", "profile")
			.redirectUri(REDIRECT_URI)
			.build());
		if (properties.microsoft().enabled()) {
			registrations.add(microsoft(properties.microsoft()));
		}
		return new InMemoryClientRegistrationRepository(registrations);
	}

	static ClientRegistration microsoft(AuthProperties.Provider client) {
		return ClientRegistration.withRegistrationId(IdentityProvider.MICROSOFT.registrationId())
			.clientId(client.clientId())
			.clientSecret(client.clientSecret())
			.clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
			.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
			.redirectUri(REDIRECT_URI)
			.scope("openid", "email", "profile")
			.authorizationUri(MICROSOFT + "/oauth2/v2.0/authorize")
			.tokenUri(MICROSOFT + "/oauth2/v2.0/token")
			.jwkSetUri(MICROSOFT + "/discovery/v2.0/keys")
			.issuerUri(MICROSOFT_ISSUER)
			// No user-info address: its claims are in the id token, read without one more call
			.userNameAttributeName(IdTokenClaimNames.SUB)
			.clientName("Microsoft")
			.build();
	}

}
