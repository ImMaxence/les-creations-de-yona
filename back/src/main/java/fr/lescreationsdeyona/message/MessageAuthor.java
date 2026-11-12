package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.monitoring.AdminSeen;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/** The admin writing, or changing a group: as their Google account says it, their email alone otherwise (tests). */
record MessageAuthor(String email, @Nullable String name, @Nullable String picture) {

	static @Nullable MessageAuthor current(AdminSeen adminSeen) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.getPrincipal() instanceof OidcUser user && user.getEmail() != null) {
			return new MessageAuthor(user.getEmail().toLowerCase(Locale.ROOT), user.getFullName(), user.getPicture());
		}
		return adminSeen.admin().map(email -> new MessageAuthor(email.toLowerCase(Locale.ROOT), null, null)).orElse(null);
	}

}
