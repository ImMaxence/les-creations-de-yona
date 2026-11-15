package fr.lescreationsdeyona.security;

import java.util.Locale;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The first accounts and the way back in, both read at start-up only.
 * <ul>
 * <li>{@code emails} ({@code APP_ADMIN_EMAILS}, comma-separated): the accounts created when there is
 * none yet (the first start of 2.19, an empty server). Each signs in once with the Google account of that
 * address, then adds what they like in "Mon compte". Ignored once an account exists.</li>
 * <li>{@code recoveryEmail} ({@code APP_ADMIN_RECOVERY_EMAIL}): when nobody can sign in any more, a link
 * valid one hour for that admin, written in the server's logs (Coolify) at each start. Removed once used.</li>
 * </ul>
 */
@ConfigurationProperties("app.admin")
public record AdminProperties(@Nullable Set<String> emails, @Nullable String recoveryEmail) {

	public AdminProperties {
		emails = emails == null ? Set.of()
				: emails.stream()
					.map(AdminProperties::normalize)
					.filter(Predicate.not(String::isEmpty))
					.collect(Collectors.toUnmodifiableSet());
		recoveryEmail = recoveryEmail == null || recoveryEmail.isBlank() ? null : normalize(recoveryEmail);
	}

	static String normalize(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

}
