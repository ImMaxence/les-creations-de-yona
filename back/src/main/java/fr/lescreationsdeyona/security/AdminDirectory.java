package fr.lescreationsdeyona.security;

import java.util.Locale;
import java.util.Set;

/** The admins who may sign in now, by the address the back-office knows them by. */
@FunctionalInterface
public interface AdminDirectory {

	/** In lower case: the active accounts, not those invited nor disabled. */
	Set<String> emails();

	default boolean isAdmin(String email) {
		return email != null && emails().contains(email.strip().toLowerCase(Locale.ROOT));
	}

}
