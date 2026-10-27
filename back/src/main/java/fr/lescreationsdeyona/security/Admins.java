package fr.lescreationsdeyona.security;

import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;

/** Whether a request comes from a signed-in admin, on routes open to everyone. */
public final class Admins {

	private Admins() {
	}

	public static boolean isAdmin(@Nullable Authentication authentication) {
		return authentication != null && authentication.getAuthorities()
			.stream()
			.anyMatch(authority -> ("ROLE_" + AdminOidcUserService.ADMIN_ROLE).equals(authority.getAuthority()));
	}

}
