package fr.lescreationsdeyona.security;

import jakarta.validation.constraints.NotEmpty;
import java.util.Locale;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Allowlist of the Google accounts allowed into the back-office ({@code APP_ADMIN_EMAILS}, comma-separated). */
@Validated
@ConfigurationProperties("app.admin")
public record AdminProperties(@NotEmpty Set<String> emails) {

	public AdminProperties {
		emails = emails.stream()
			.map(AdminProperties::normalize)
			.filter(Predicate.not(String::isEmpty))
			.collect(Collectors.toUnmodifiableSet());
	}

	public boolean isAdmin(String email) {
		return email != null && emails.contains(normalize(email));
	}

	private static String normalize(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

}
