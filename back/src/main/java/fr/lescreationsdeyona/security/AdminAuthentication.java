package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import java.io.Serial;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

/** The session of an admin, the same whatever the way they came in. */
public final class AdminAuthentication extends AbstractAuthenticationToken {

	@Serial
	private static final long serialVersionUID = 1L;

	static final String ADMIN_ROLE = "ADMIN";

	private final AdminPrincipal principal;

	public AdminAuthentication(AdminPrincipal principal) {
		super(AuthorityUtils.createAuthorityList("ROLE_" + ADMIN_ROLE));
		this.principal = principal;
		super.setAuthenticated(true);
	}

	static AdminAuthentication of(Account account) {
		return new AdminAuthentication(AdminPrincipal.of(account));
	}

	@Override
	public AdminPrincipal getPrincipal() {
		return principal;
	}

	@Override
	public @Nullable Object getCredentials() {
		return null;
	}

	@Override
	public void setAuthenticated(boolean authenticated) {
		if (authenticated) {
			throw new IllegalArgumentException("Only the sign-in makes an admin session");
		}
		super.setAuthenticated(false);
	}

	/** The admin of this authentication, if it is one. */
	public static Optional<AdminPrincipal> principalOf(@Nullable Object authentication) {
		return authentication instanceof AdminAuthentication admin ? Optional.of(admin.getPrincipal()) : Optional.empty();
	}

	/** The admin making the current request, if any. */
	public static Optional<AdminPrincipal> current() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		return principalOf(authentication);
	}

}
