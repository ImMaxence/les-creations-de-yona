package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.security.AccountSignIn.Outcome;
import fr.lescreationsdeyona.security.AccountSignIn.ProviderAccount;
import fr.lescreationsdeyona.security.AccountSignIn.Refusal;
import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import fr.lescreationsdeyona.security.AccountTypes.SignInMethod;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.context.SecurityContextRepository;

class AccountSignInTest {

	private final AdminAccounts accounts = mock(AdminAccounts.class);

	private final AccessLinks links = mock(AccessLinks.class);

	private final AccountSignIn signIn = new AccountSignIn(accounts, links, mock(SecurityContextRepository.class));

	private static Account account(long id, String email, AccountStatus status) {
		return new Account(id, email, null, status, 0, null, Instant.EPOCH, null, null, null);
	}

	private static ProviderAccount google(String subject, String email, boolean verified) {
		return new ProviderAccount(IdentityProvider.GOOGLE, subject, email, verified, "Yona", "https://lh3.googleusercontent.com/a/photo");
	}

	private void known(Account account) {
		when(accounts.find(account.id())).thenReturn(Optional.of(account));
		when(accounts.findByEmail(account.email())).thenReturn(Optional.of(account));
	}

	@Test
	void letsInTheAdminOfAGoogleAccount() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(IdentityProvider.GOOGLE, "sub-yona")).thenReturn(Optional.of(yona));

		Outcome outcome = signIn.withProvider(google("sub-yona", "yona@example.fr", true), null);

		assertThat(outcome).isEqualTo(new Outcome.SignedIn(yona, "/admin"));
		verify(accounts).signedIn(1, SignInMethod.GOOGLE, "Yona", "https://lh3.googleusercontent.com/a/photo");
		verify(accounts).used(IdentityProvider.GOOGLE, "sub-yona", "yona@example.fr");
	}

	@Test
	void keepsOutADisabledAdmin() {
		Account yona = account(1, "yona@example.fr", AccountStatus.DISABLED);
		when(accounts.findByIdentity(IdentityProvider.GOOGLE, "sub-yona")).thenReturn(Optional.of(yona));

		assertThat(signIn.withProvider(google("sub-yona", "yona@example.fr", true), null)).isEqualTo(new Outcome.Refused(Refusal.DISABLED));
		verify(accounts, never()).signedIn(anyLong(), any(), any(), any());
	}

	@Test
	void keepsOutAGoogleAccountOfNoAdmin() {
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		when(accounts.findByEmail(anyString())).thenReturn(Optional.empty());

		assertThat(signIn.withProvider(google("sub-stranger", "stranger@example.fr", true), null))
			.isEqualTo(new Outcome.Refused(Refusal.UNKNOWN));
	}

	@Test
	void linksTheGoogleAccountOfAFirstAccountByItsVerifiedAddress() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		when(accounts.methodCount(1)).thenReturn(0);

		assertThat(signIn.withProvider(google("sub-yona", "yona@example.fr", true), null)).isInstanceOf(Outcome.SignedIn.class);
		verify(accounts).link(1, IdentityProvider.GOOGLE, "sub-yona", "yona@example.fr");
	}

	@Test
	void linksNoGoogleAccountWhoseAddressIsNotVerified() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());

		assertThat(signIn.withProvider(google("sub-other", "yona@example.fr", false), null)).isEqualTo(new Outcome.Refused(Refusal.UNKNOWN));
		verify(accounts, never()).link(anyLong(), any(), anyString(), any());
	}

	@Test
	void linksNoAccountByItsAddressOnceItHasAWayIn() {
		// Someone holding a Google account of that address later: not let into an account that already has its ways
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		when(accounts.methodCount(1)).thenReturn(1);

		assertThat(signIn.withProvider(google("sub-other", "yona@example.fr", true), null)).isEqualTo(new Outcome.Refused(Refusal.UNKNOWN));
		verify(accounts, never()).link(anyLong(), any(), anyString(), any());
	}

	@Test
	void linksNoMicrosoftAccountByItsAddress() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		when(accounts.methodCount(1)).thenReturn(0);

		ProviderAccount microsoft = new ProviderAccount(IdentityProvider.MICROSOFT, "sub-ms", "yona@example.fr", true, "Yona", null);

		assertThat(signIn.withProvider(microsoft, null)).isEqualTo(new Outcome.Refused(Refusal.UNKNOWN));
	}

	@Test
	void linksTheAccountChosenFromMonCompte() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(IdentityProvider.MICROSOFT, "sub-ms")).thenReturn(Optional.empty());

		ProviderAccount microsoft = new ProviderAccount(IdentityProvider.MICROSOFT, "sub-ms", "yona@outlook.fr", false, "Yona", null);

		assertThat(signIn.withProvider(microsoft, new SignInIntent.Link(1)))
			.isEqualTo(new Outcome.SignedIn(yona, "/admin/mon-compte?lie=microsoft"));
		verify(accounts).link(1, IdentityProvider.MICROSOFT, "sub-ms", "yona@outlook.fr");
	}

	@Test
	void linksNoAccountAlreadyAnotherAdmins() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(IdentityProvider.GOOGLE, "sub-max")).thenReturn(Optional.of(account(2, "max@example.fr", AccountStatus.ACTIVE)));

		assertThat(signIn.withProvider(google("sub-max", "max@example.fr", true), new SignInIntent.Link(1)))
			.isEqualTo(new Outcome.Refused(Refusal.TAKEN));
		verify(accounts, never()).link(anyLong(), any(), anyString(), any());
	}

	@Test
	void letsAnInvitedAdminInWithTheirLink() {
		Account lea = account(3, "lea@example.fr", AccountStatus.INVITED);
		known(lea);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		AccessLink invitation = new AccessLink(3, AccessPurpose.INVITATION, Instant.now(), Instant.now().plusSeconds(3600));
		when(links.find("token")).thenReturn(Optional.of(invitation));

		Outcome outcome = signIn.withProvider(google("sub-lea", "lea.perso@gmail.com", true), new SignInIntent.Access("token"));

		assertThat(outcome).isInstanceOf(Outcome.SignedIn.class);
		assertThat(((Outcome.SignedIn) outcome).landing()).isEqualTo("/admin/mon-compte?bienvenue");
		// Another address than the one of the invitation: the link says who it is for
		verify(accounts).link(3, IdentityProvider.GOOGLE, "sub-lea", "lea.perso@gmail.com");
		verify(accounts).setStatus(3, AccountStatus.ACTIVE);
		verify(links).delete(3);
	}

	@Test
	void letsNobodyInWithAnExpiredLink() {
		when(links.find("old")).thenReturn(Optional.empty());
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());

		assertThat(signIn.withProvider(google("sub-lea", "lea@example.fr", true), new SignInIntent.Access("old")))
			.isEqualTo(new Outcome.Refused(Refusal.LINK_EXPIRED));
		verify(accounts, never()).link(anyLong(), any(), anyString(), any());
	}

	@Test
	void givesARecoveredAdminTheirNewGoogleAccount() {
		Account yona = account(1, "yona@example.fr", AccountStatus.ACTIVE);
		known(yona);
		when(accounts.findByIdentity(any(), anyString())).thenReturn(Optional.empty());
		when(links.find("token")).thenReturn(Optional.of(new AccessLink(1, AccessPurpose.RECOVERY, Instant.now(), Instant.now().plusSeconds(60))));

		Outcome outcome = signIn.withProvider(google("sub-new", "yona.new@gmail.com", true), new SignInIntent.Access("token"));

		assertThat(((Outcome.SignedIn) outcome).landing()).isEqualTo("/admin/mon-compte?recupere");
		verify(accounts).unlink(1, IdentityProvider.GOOGLE);
		verify(accounts).link(eq(1L), eq(IdentityProvider.GOOGLE), eq("sub-new"), any());
		verify(accounts, never()).setStatus(anyLong(), any());
	}

	@Test
	void letsAPasskeyInOnlyForAnActiveAccount() {
		known(account(1, "yona@example.fr", AccountStatus.ACTIVE));
		known(account(2, "max@example.fr", AccountStatus.DISABLED));

		assertThat(signIn.withPasskey("yona@example.fr")).isPresent();
		assertThat(signIn.withPasskey("max@example.fr")).isEmpty();
		verify(accounts).signedIn(1, SignInMethod.PASSKEY, null, null);
	}

}
