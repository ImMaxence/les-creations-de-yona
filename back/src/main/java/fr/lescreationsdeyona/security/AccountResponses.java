package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import fr.lescreationsdeyona.security.AccountTypes.SignInMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the API says of the accounts, and what it is sent. */
public final class AccountResponses {

	private AccountResponses() {
	}

	/** The buttons of the sign-in page: Google always, Microsoft when its client is set. Passkeys always. */
	public record SignInMethods(boolean google, boolean microsoft) {
	}

	/** The page of a link to come in once: who it is for, and the ways offered. */
	public record AccessLinkPage(String email, @Nullable String name, AccessPurpose purpose, Instant expiresAt, SignInMethods methods) {
	}

	/** A Google or Microsoft account linked to an admin. */
	public record LinkedIdentity(IdentityProvider provider, @Nullable String email, Instant linkedAt, @Nullable Instant lastUsedAt) {
	}

	/** A passkey. {@code synced}: kept by iCloud, Google Password Manager or another manager, on all their devices. */
	public record PasskeyResponse(String id, String label, boolean synced, Instant createdAt, @Nullable Instant lastUsedAt) {
	}

	/** "Mon compte". */
	public record MyAccount(long id, String email, @Nullable String name,
			@Schema(description = "Their own photo, or the one of their Google account") @Nullable String picture,
			@Schema(description = "A photo of their own, which can be removed") boolean ownPhoto, List<LinkedIdentity> identities,
			List<PasskeyResponse> passkeys, SignInMethods methods) {
	}

	/** A link waiting to be used; {@code expired}: too late, a new one is needed. */
	public record PendingAccessLink(AccessPurpose purpose, Instant createdAt, Instant expiresAt, boolean expired) {
	}

	/** A link just made: its address is shown this once (only a hash of it is kept). */
	public record IssuedAccessLink(String url, AccessPurpose purpose, Instant expiresAt) {
	}

	/** An admin, as "Utilisateurs" lists them. {@code me}: the one asking (who cannot disable nor delete themselves). */
	public record AdminUser(long id, String email, @Nullable String name, @Nullable String picture, AccountStatus status, Instant createdAt,
			@Nullable String createdBy, @Nullable Instant lastSignInAt, @Nullable SignInMethod lastSignInMethod,
			@Schema(description = "Last request in the back-office, to 5 minutes (2.21); a sign-in counts") @Nullable Instant lastSeenAt,
			List<IdentityProvider> providers, int passkeys, @Nullable PendingAccessLink link, boolean me) {
	}

	/** A new admin and the link of their invitation. */
	public record InvitedAdmin(AdminUser user, IssuedAccessLink link) {
	}

	public record InviteForm(@NotBlank @Email @Size(max = 320) String email, @Size(max = 60) @Nullable String name) {
	}

	public record AccountNameForm(@NotBlank @Size(max = 60) String name) {
	}

	public record AccountStatusForm(@Schema(description = "ACTIVE or DISABLED; INVITED is left by the invitation link") @NotNull AccountStatus status) {
	}

	public record PasskeyLabelForm(@NotBlank @Size(max = 60) String label) {
	}

}
