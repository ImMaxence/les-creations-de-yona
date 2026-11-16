package fr.lescreationsdeyona.security;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** The words of the accounts of the back-office. */
public final class AccountTypes {

	private AccountTypes() {
	}

	/** INVITED until the first sign-in with the invitation link; DISABLED keeps someone out, nothing lost. */
	public enum AccountStatus {
		INVITED, ACTIVE, DISABLED
	}

	/** A provider of OpenID Connect, by the id of its client registration (and of its return address). */
	public enum IdentityProvider {

		GOOGLE("google"), MICROSOFT("microsoft");

		private final String registrationId;

		IdentityProvider(String registrationId) {
			this.registrationId = registrationId;
		}

		public String registrationId() {
			return registrationId;
		}

		static @Nullable IdentityProvider of(String registrationId) {
			for (IdentityProvider provider : values()) {
				if (provider.registrationId.equals(registrationId)) {
					return provider;
				}
			}
			return null;
		}

	}

	/** How an admin came in last. */
	public enum SignInMethod {

		GOOGLE, MICROSOFT, PASSKEY;

		static SignInMethod of(IdentityProvider provider) {
			return provider == IdentityProvider.GOOGLE ? GOOGLE : MICROSOFT;
		}

	}

	/** What a link to come in once is for. */
	public enum AccessPurpose {
		INVITATION, RECOVERY
	}

	/**
	 * An admin, as kept. {@code photoVersion} is 0 without a photo of their own; {@code providerPicture} is the
	 * photo of their Google account.
	 */
	public record Account(long id, String email, @Nullable String name, AccountStatus status, int photoVersion,
			@Nullable String providerPicture, Instant createdAt, @Nullable String createdBy, @Nullable Instant lastSignInAt,
			@Nullable SignInMethod lastSignInMethod, @Nullable Instant lastSeenAt) {

		/** Their own photo, or the one of their Google account, or none (their initial is shown). */
		public @Nullable String picture() {
			return photoVersion > 0 ? "/api/admin/accounts/" + id + "/photo?v=" + photoVersion : providerPicture;
		}

		/** Their name, or the start of their address without one yet. */
		public String displayName() {
			return name != null ? name : email.substring(0, Math.max(1, email.indexOf('@')));
		}

	}

	/** A Google or Microsoft account linked to an admin. */
	public record Identity(long accountId, IdentityProvider provider, String subject, @Nullable String email, Instant linkedAt,
			@Nullable Instant lastUsedAt) {
	}

	/** A passkey of an admin, as "Mon compte" lists it. {@code id}: its credential id, in base64url. */
	public record Passkey(long accountId, String id, String label, boolean synced, Instant createdAt, @Nullable Instant lastUsedAt) {
	}

	/** A link to come in once, without its token (only its hash is kept). */
	public record AccessLink(long accountId, AccessPurpose purpose, Instant createdAt, Instant expiresAt) {
	}

}
