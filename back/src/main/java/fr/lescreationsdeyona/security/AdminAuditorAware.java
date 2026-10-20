package fr.lescreationsdeyona.security;

import java.util.Optional;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

/** Email of the logged-in admin, written to {@code created_by} and {@code updated_by}. */
@Component
class AdminAuditorAware implements AuditorAware<String> {

	@Override
	public Optional<String> getCurrentAuditor() {
		return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
			.map(Authentication::getPrincipal)
			.filter(OidcUser.class::isInstance)
			.map(OidcUser.class::cast)
			.map(OidcUser::getEmail);
	}

}
