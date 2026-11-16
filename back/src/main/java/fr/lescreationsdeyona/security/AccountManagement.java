package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountResponses.AdminUser;
import fr.lescreationsdeyona.security.AccountResponses.InviteForm;
import fr.lescreationsdeyona.security.AccountResponses.InvitedAdmin;
import fr.lescreationsdeyona.security.AccountResponses.IssuedAccessLink;
import fr.lescreationsdeyona.security.AccountResponses.LinkedIdentity;
import fr.lescreationsdeyona.security.AccountResponses.MyAccount;
import fr.lescreationsdeyona.security.AccountResponses.PasskeyResponse;
import fr.lescreationsdeyona.security.AccountResponses.PendingAccessLink;
import fr.lescreationsdeyona.security.AccountResponses.SignInMethods;
import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.Identity;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * "Mon compte" and "Utilisateurs": what an admin changes of their own account, and of the others'.
 * Nobody is left without a way in: the last one of an account is not removed, an admin does not disable
 * nor delete themselves (so one admin at least always remains).
 */
@Service
class AccountManagement {

	private final AdminAccounts accounts;

	private final AccessLinks links;

	private final PasskeyStore.Credentials passkeys;

	private final AuthProperties properties;

	private final AuditLog auditLog;

	private final ApplicationEventPublisher events;

	AccountManagement(AdminAccounts accounts, AccessLinks links, PasskeyStore.Credentials passkeys, AuthProperties properties,
			AuditLog auditLog, ApplicationEventPublisher events) {
		this.accounts = accounts;
		this.links = links;
		this.passkeys = passkeys;
		this.properties = properties;
		this.auditLog = auditLog;
		this.events = events;
	}

	SignInMethods methods() {
		return new SignInMethods(true, properties.microsoft().enabled());
	}

	// Mon compte

	MyAccount mine(AdminPrincipal me) {
		Account account = account(me.id());
		return new MyAccount(account.id(), account.email(), account.name(), account.picture(), account.photoVersion() > 0,
				accounts.identities(account.id()).stream().map(AccountManagement::linked).toList(),
				passkeys.of(account.id()).stream().map(passkey -> new PasskeyResponse(passkey.id(), passkey.label(), passkey.synced(),
						passkey.createdAt(), passkey.lastUsedAt())).toList(),
				methods());
	}

	@Transactional
	MyAccount rename(AdminPrincipal me, String name) {
		String line = AdminAccounts.trimmedName(name);
		if (line == null) {
			throw new ApiException(ErrorCode.ACCOUNT_NAME_REQUIRED);
		}
		accounts.rename(me.id(), line);
		return mine(me);
	}

	@Transactional
	MyAccount setPhoto(AdminPrincipal me, byte[] webp) {
		accounts.setPhoto(me.id(), webp);
		return mine(me);
	}

	@Transactional
	MyAccount removePhoto(AdminPrincipal me) {
		accounts.removePhoto(me.id());
		return mine(me);
	}

	@Transactional
	MyAccount unlink(AdminPrincipal me, IdentityProvider provider) {
		if (accounts.identities(me.id()).stream().noneMatch(identity -> identity.provider() == provider)) {
			throw new ApiException(ErrorCode.ACCOUNT_IDENTITY_NOT_FOUND);
		}
		keepOneWayIn(me.id());
		accounts.unlink(me.id(), provider);
		return mine(me);
	}

	@Transactional
	MyAccount renamePasskey(AdminPrincipal me, String id, String label) {
		if (!passkeys.rename(me.id(), credentialId(id), label)) {
			throw new ApiException(ErrorCode.PASSKEY_NOT_FOUND);
		}
		return mine(me);
	}

	@Transactional
	MyAccount deletePasskey(AdminPrincipal me, String id) {
		Bytes credentialId = credentialId(id);
		if (passkeys.of(me.id()).stream().noneMatch(passkey -> passkey.id().equals(credentialId.toBase64UrlString()))) {
			throw new ApiException(ErrorCode.PASSKEY_NOT_FOUND);
		}
		keepOneWayIn(me.id());
		passkeys.delete(me.id(), credentialId);
		return mine(me);
	}

	// Utilisateurs

	List<AdminUser> users(AdminPrincipal me) {
		Map<Long, List<Identity>> identities = accounts.identitiesOfAll();
		Map<Long, Integer> passkeyCounts = passkeys.countByAccount();
		Map<Long, AccessLink> pending = links.pending();
		Instant now = Instant.now();
		return accounts.all()
			.stream()
			.map(account -> user(account, identities.getOrDefault(account.id(), List.of()), passkeyCounts.getOrDefault(account.id(), 0),
					pending.get(account.id()), now, me))
			.toList();
	}

	/** A new admin, INVITED until they come in with the link given here. */
	@Transactional
	InvitedAdmin invite(InviteForm form, AdminPrincipal me, UriComponentsBuilder site) {
		if (accounts.findByEmail(form.email()).isPresent()) {
			throw new ApiException(ErrorCode.ACCOUNT_EMAIL_TAKEN);
		}
		Account account = accounts.create(form.email(), AdminAccounts.trimmedName(form.name()), AccountStatus.INVITED, me.email());
		AccessLinks.Issued issued = links.issue(account.id(), AccessPurpose.INVITATION, AccessLinks.INVITATION_VALIDITY, me.email());
		auditLog.record(AuditAction.CREATED, AuditKind.ADMIN_ACCOUNT, "Invitation de " + account.displayName(), account.id());
		return new InvitedAdmin(user(account, List.of(), 0, issued.link(), Instant.now(), me), issued(issued, site));
	}

	/**
	 * A new link for this admin, in place of the one before: a new invitation for an admin who never came in,
	 * a recovery link (one day) for the others, to add a way in when theirs are lost.
	 */
	@Transactional
	IssuedAccessLink issueLink(long id, AdminPrincipal me, UriComponentsBuilder site) {
		Account account = account(id);
		if (account.status() == AccountStatus.DISABLED) {
			throw new ApiException(ErrorCode.ACCOUNT_DISABLED);
		}
		boolean invitation = account.status() == AccountStatus.INVITED;
		AccessLinks.Issued issued = links.issue(id, invitation ? AccessPurpose.INVITATION : AccessPurpose.RECOVERY,
				invitation ? AccessLinks.INVITATION_VALIDITY : AccessLinks.RECOVERY_VALIDITY, me.email());
		auditLog.record(AuditAction.UPDATED, AuditKind.ADMIN_ACCOUNT,
				(invitation ? "Nouvelle invitation de " : "Lien de récupération pour ") + account.displayName(), id);
		return issued(issued, site);
	}

	@Transactional
	void cancelLink(long id) {
		Account account = account(id);
		links.delete(id);
		auditLog.record(AuditAction.UPDATED, AuditKind.ADMIN_ACCOUNT, "Lien révoqué pour " + account.displayName(), id);
	}

	/**
	 * Disabled: out at once, on every device, their link cancelled. Enabled again: as they were, invited if
	 * they never came in.
	 */
	@Transactional
	AdminUser setStatus(long id, AccountStatus status, AdminPrincipal me) {
		Account account = account(id);
		if (id == me.id()) {
			throw new ApiException(ErrorCode.ACCOUNT_SELF);
		}
		if (status == AccountStatus.DISABLED && account.status() != AccountStatus.DISABLED) {
			accounts.setStatus(id, AccountStatus.DISABLED);
			links.delete(id);
			events.publishEvent(new AccountClosed(account.email()));
			auditLog.record(AuditAction.UPDATED, AuditKind.ADMIN_ACCOUNT, "Compte de " + account.displayName() + " désactivé", id);
		}
		else if (status == AccountStatus.ACTIVE && account.status() == AccountStatus.DISABLED) {
			accounts.setStatus(id, account.lastSignInAt() == null ? AccountStatus.INVITED : AccountStatus.ACTIVE);
			auditLog.record(AuditAction.UPDATED, AuditKind.ADMIN_ACCOUNT, "Compte de " + account.displayName() + " réactivé", id);
		}
		else if (status == AccountStatus.INVITED) {
			throw new ApiException(ErrorCode.ACCOUNT_STATUS_INVALID);
		}
		return users(me).stream().filter(user -> user.id() == id).findFirst().orElseThrow();
	}

	/** Their account goes; what they wrote stays, under their address. */
	@Transactional
	void delete(long id, AdminPrincipal me) {
		Account account = account(id);
		if (id == me.id()) {
			throw new ApiException(ErrorCode.ACCOUNT_SELF);
		}
		accounts.delete(id);
		events.publishEvent(new AccountClosed(account.email()));
		auditLog.record(AuditAction.DELETED, AuditKind.ADMIN_ACCOUNT, "Compte de " + account.displayName(), id);
	}

	private void keepOneWayIn(long id) {
		if (accounts.methodCount(id) <= 1) {
			throw new ApiException(ErrorCode.ACCOUNT_LAST_METHOD);
		}
	}

	private Account account(long id) {
		return accounts.find(id).orElseThrow(() -> new ApiException(ErrorCode.ACCOUNT_NOT_FOUND));
	}

	private static IssuedAccessLink issued(AccessLinks.Issued issued, UriComponentsBuilder site) {
		String url = site.cloneBuilder().replacePath("/admin/acces/{token}").replaceQuery(null).buildAndExpand(issued.token()).toUriString();
		return new IssuedAccessLink(url, issued.link().purpose(), issued.link().expiresAt());
	}

	private static AdminUser user(Account account, List<Identity> identities, int passkeyCount, @Nullable AccessLink link, Instant now,
			AdminPrincipal me) {
		return new AdminUser(account.id(), account.email(), account.name(), account.picture(), account.status(), account.createdAt(),
				account.createdBy(), account.lastSignInAt(), account.lastSignInMethod(), account.lastSeenAt(), identities.stream().map(Identity::provider).toList(), passkeyCount,
				link == null ? null : new PendingAccessLink(link.purpose(), link.createdAt(), link.expiresAt(), !link.expiresAt().isAfter(now)),
				account.id() == me.id());
	}

	private static LinkedIdentity linked(Identity identity) {
		return new LinkedIdentity(identity.provider(), identity.email(), identity.linkedAt(), identity.lastUsedAt());
	}

	private static Bytes credentialId(String id) {
		try {
			return Bytes.fromBase64(id);
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(ErrorCode.PASSKEY_NOT_FOUND);
		}
	}

}
