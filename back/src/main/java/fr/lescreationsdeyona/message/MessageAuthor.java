package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.security.AdminAuthentication;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

/** The admin writing, or changing a group: as their account says it, their address alone otherwise (tests). */
record MessageAuthor(String email, @Nullable String name, @Nullable String picture) {

	static @Nullable MessageAuthor current(AdminSeen adminSeen) {
		return AdminAuthentication.current()
			.map(admin -> new MessageAuthor(admin.email().toLowerCase(Locale.ROOT), admin.name(), admin.picture()))
			.orElseGet(() -> adminSeen.admin().map(email -> new MessageAuthor(email.toLowerCase(Locale.ROOT), null, null)).orElse(null));
	}

}
