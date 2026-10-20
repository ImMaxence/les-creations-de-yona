package fr.lescreationsdeyona.security;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.oidc.StandardClaimNames;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

/** Lets a Google account in only if its email is verified and in the admin allowlist. */
@Service
@RequiredArgsConstructor
class AdminOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

	static final String ADMIN_ROLE = "ADMIN";

	private static final Logger log = LoggerFactory.getLogger(AdminOidcUserService.class);

	private final OidcUserService googleUserService = new OidcUserService();

	private final AdminProperties adminProperties;

	@Override
	public OidcUser loadUser(OidcUserRequest userRequest) {
		OidcUser user = googleUserService.loadUser(userRequest);
		if (!Boolean.TRUE.equals(user.getEmailVerified()) || !adminProperties.isAdmin(user.getEmail())) {
			log.warn("Back-office login refused for {}", user.getEmail());
			throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.ACCESS_DENIED));
		}
		return new DefaultOidcUser(AuthorityUtils.createAuthorityList("ROLE_" + ADMIN_ROLE), user.getIdToken(),
				user.getUserInfo(), StandardClaimNames.EMAIL);
	}

}
