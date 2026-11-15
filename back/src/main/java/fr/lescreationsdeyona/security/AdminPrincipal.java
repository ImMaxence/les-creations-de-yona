package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import java.io.Serial;
import java.io.Serializable;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.AuthenticatedPrincipal;

/**
 * The admin signed in, however they came in (Google, Microsoft, a passkey). Refreshed at each request of
 * the back-office ({@link AdminAccountFilter}): a new name or photo is seen at once.
 */
public record AdminPrincipal(long id, String email, String name, @Nullable String picture) implements AuthenticatedPrincipal, Serializable {

	@Serial
	private static final long serialVersionUID = 1L;

	static AdminPrincipal of(Account account) {
		return new AdminPrincipal(account.id(), account.email(), account.displayName(), account.picture());
	}

	/** Their address, for Spring Security ({@code Authentication.getName()}). */
	@Override
	public String getName() {
		return email;
	}

}
