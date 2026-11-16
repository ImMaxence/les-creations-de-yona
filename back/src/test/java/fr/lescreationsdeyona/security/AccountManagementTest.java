package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountResponses.IssuedAccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.Identity;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.util.UriComponentsBuilder;

class AccountManagementTest {

	private final AdminAccounts accounts = mock(AdminAccounts.class);

	private final AccessLinks links = mock(AccessLinks.class);

	private final PasskeyStore.Credentials passkeys = mock(PasskeyStore.Credentials.class);

	private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);

	private final AccountManagement management = new AccountManagement(accounts, links, passkeys,
			new AuthProperties(new AuthProperties.Provider("id", "secret"), null, List.of()), mock(AuditLog.class), events);

	private final AdminPrincipal yona = new AdminPrincipal(1, "yona@example.fr", "Yona", null);

	private static Account account(long id, String email, AccountStatus status) {
		return new Account(id, email, null, status, 0, null, Instant.EPOCH, null, null, null, null);
	}

	private final UriComponentsBuilder site = UriComponentsBuilder.fromUriString("https://les-creations-de-yona.fr/api/admin/accounts");

	@Test
	void keepsTheLastWayInOfAnAccount() {
		when(accounts.identities(1)).thenReturn(List.of(new Identity(1, IdentityProvider.GOOGLE, "sub", null, Instant.EPOCH, null)));
		when(accounts.methodCount(1)).thenReturn(1);

		assertThatThrownBy(() -> management.unlink(yona, IdentityProvider.GOOGLE)).isInstanceOf(ApiException.class)
			.extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.ACCOUNT_LAST_METHOD);
		verify(accounts, never()).unlink(anyLong(), any());
	}

	@Test
	void unlinksGoogleWhenAPasskeyRemains() {
		when(accounts.identities(1)).thenReturn(List.of(new Identity(1, IdentityProvider.GOOGLE, "sub", null, Instant.EPOCH, null)));
		when(accounts.methodCount(1)).thenReturn(2);
		when(accounts.find(1)).thenReturn(Optional.of(account(1, "yona@example.fr", AccountStatus.ACTIVE)));

		management.unlink(yona, IdentityProvider.GOOGLE);

		verify(accounts).unlink(1, IdentityProvider.GOOGLE);
	}

	@Test
	void letsNoAdminDisableNorDeleteThemselves() {
		when(accounts.find(1)).thenReturn(Optional.of(account(1, "yona@example.fr", AccountStatus.ACTIVE)));

		assertThatThrownBy(() -> management.setStatus(1, AccountStatus.DISABLED, yona)).extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.ACCOUNT_SELF);
		assertThatThrownBy(() -> management.delete(1, yona)).extracting(ex -> ((ApiException) ex).getCode()).isEqualTo(ErrorCode.ACCOUNT_SELF);
		verify(accounts, never()).delete(anyLong());
	}

	@Test
	void disablesAnotherAdminAndCancelsTheirLink() {
		when(accounts.find(2)).thenReturn(Optional.of(account(2, "max@example.fr", AccountStatus.ACTIVE)));
		when(accounts.all()).thenReturn(List.of(account(2, "max@example.fr", AccountStatus.DISABLED)));
		when(accounts.identitiesOfAll()).thenReturn(Map.of());
		when(passkeys.countByAccount()).thenReturn(Map.of());
		when(links.pending()).thenReturn(Map.of());

		management.setStatus(2, AccountStatus.DISABLED, yona);

		verify(accounts).setStatus(2, AccountStatus.DISABLED);
		verify(links).delete(2);
		verify(events).publishEvent(new AccountClosed("max@example.fr"));
	}

	@Test
	void invitesNoAddressAlreadyAnAccount() {
		when(accounts.findByEmail("max@example.fr")).thenReturn(Optional.of(account(2, "max@example.fr", AccountStatus.ACTIVE)));

		assertThatThrownBy(() -> management.invite(new AccountResponses.InviteForm("max@example.fr", null), yona, site))
			.extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.ACCOUNT_EMAIL_TAKEN);
	}

	@Test
	void givesALinkToThePageOfTheSite() {
		when(accounts.find(2)).thenReturn(Optional.of(account(2, "max@example.fr", AccountStatus.ACTIVE)));
		AccessLink recovery = new AccessLink(2, AccessPurpose.RECOVERY, Instant.EPOCH, Instant.EPOCH.plus(AccessLinks.RECOVERY_VALIDITY));
		when(links.issue(eq(2L), eq(AccessPurpose.RECOVERY), eq(AccessLinks.RECOVERY_VALIDITY), any()))
			.thenReturn(new AccessLinks.Issued("abc_DEF-123", recovery));

		IssuedAccessLink link = management.issueLink(2, yona, site);

		assertThat(link.url()).isEqualTo("https://les-creations-de-yona.fr/admin/acces/abc_DEF-123");
		assertThat(link.purpose()).isEqualTo(AccessPurpose.RECOVERY);
	}

	@Test
	void invitesAgainAnAdminWhoNeverCameIn() {
		when(accounts.find(3)).thenReturn(Optional.of(account(3, "lea@example.fr", AccountStatus.INVITED)));
		AccessLink invitation = new AccessLink(3, AccessPurpose.INVITATION, Instant.EPOCH, Instant.EPOCH);
		when(links.issue(eq(3L), eq(AccessPurpose.INVITATION), eq(AccessLinks.INVITATION_VALIDITY), any()))
			.thenReturn(new AccessLinks.Issued("token", invitation));

		assertThat(management.issueLink(3, yona, site).purpose()).isEqualTo(AccessPurpose.INVITATION);
	}

	@Test
	void givesNoLinkToADisabledAdmin() {
		when(accounts.find(2)).thenReturn(Optional.of(account(2, "max@example.fr", AccountStatus.DISABLED)));

		assertThatThrownBy(() -> management.issueLink(2, yona, site)).extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.ACCOUNT_DISABLED);
	}

}
