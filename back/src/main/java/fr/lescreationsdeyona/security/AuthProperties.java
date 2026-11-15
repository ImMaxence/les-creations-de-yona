package fr.lescreationsdeyona.security;

import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * The ways into the back-office.
 * <ul>
 * <li>{@code google}: the OAuth client of Google Cloud ({@code GOOGLE_CLIENT_ID}, {@code GOOGLE_CLIENT_SECRET}),
 * also used by the backups to Google Drive;</li>
 * <li>{@code microsoft}: optional, an application of the Microsoft Entra portal for personal accounts
 * (Outlook, Hotmail…), {@code MICROSOFT_CLIENT_ID} and {@code MICROSOFT_CLIENT_SECRET}. Without them, no
 * Microsoft button;</li>
 * <li>{@code passkeyOrigins}: the addresses the passkeys are made on ({@code PASSKEY_ORIGINS}, comma-separated,
 * {@code app.site-url} by default). A passkey belongs to a domain: the first one's names them all.</li>
 * </ul>
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(Provider google, @Nullable Provider microsoft, List<String> passkeyOrigins) {

	public AuthProperties {
		microsoft = microsoft == null ? new Provider(null, null) : microsoft;
		passkeyOrigins = passkeyOrigins.stream().map(String::strip).filter(StringUtils::hasText).map(AuthProperties::withoutSlash).toList();
	}

	/** The client of an OpenID Connect provider; unused when either value is missing. */
	public record Provider(@Nullable String clientId, @Nullable String clientSecret) {

		public boolean enabled() {
			return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
		}

	}

	private static String withoutSlash(String origin) {
		return origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin;
	}

}
