package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;

class AdminAccountFilterTest {

	private final AdminAccounts accounts = mock(AdminAccounts.class);

	private final SecurityContextRepository repository = mock(SecurityContextRepository.class);

	private final AdminAccountFilter filter = new AdminAccountFilter(accounts, repository);

	private final MockHttpSession session = new MockHttpSession();

	private final MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/recipes");

	@AfterEach
	void clear() {
		SecurityContextHolder.clearContext();
	}

	private static Account yona(String name, AccountStatus status) {
		return new Account(1, "yona@example.fr", name, status, 0, null, Instant.EPOCH, null, null, null, null);
	}

	private void signedInAs(Account account) {
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(AdminAuthentication.of(account));
		SecurityContextHolder.setContext(context);
		request.setSession(session);
	}

	@Test
	void letsAnActiveAdminGoOn() throws Exception {
		signedInAs(yona("Yona", AccountStatus.ACTIVE));
		when(accounts.find(1)).thenReturn(Optional.of(yona("Yona", AccountStatus.ACTIVE)));

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		assertThat(AdminAuthentication.current()).isPresent();
		assertThat(session.isInvalid()).isFalse();
		verify(repository, never()).saveContext(any(), any(), any());
	}

	@Test
	void endsTheSessionOfADisabledAdminAtOnce() throws Exception {
		signedInAs(yona("Yona", AccountStatus.ACTIVE));
		when(accounts.find(1)).thenReturn(Optional.of(yona("Yona", AccountStatus.DISABLED)));

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		assertThat(AdminAuthentication.current()).isEmpty();
		assertThat(session.isInvalid()).isTrue();
	}

	@Test
	void endsTheSessionOfADeletedAdmin() throws Exception {
		signedInAs(yona("Yona", AccountStatus.ACTIVE));
		when(accounts.find(1)).thenReturn(Optional.empty());

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		assertThat(session.isInvalid()).isTrue();
	}

	@Test
	void carriesANewNameInTheSession() throws Exception {
		signedInAs(yona("Yona", AccountStatus.ACTIVE));
		when(accounts.find(1)).thenReturn(Optional.of(yona("Yona B.", AccountStatus.ACTIVE)));

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		assertThat(AdminAuthentication.current()).map(AdminPrincipal::name).contains("Yona B.");
		verify(repository).saveContext(any(), any(), any());
	}

	@Test
	void notesTheVisitEveryFiveMinutesAtMost() throws Exception {
		signedInAs(yona("Yona", AccountStatus.ACTIVE));
		when(accounts.find(1)).thenReturn(Optional.of(seen(Instant.now().minusSeconds(60))));

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		verify(accounts, never()).seen(1);

		when(accounts.find(1)).thenReturn(Optional.of(seen(Instant.now().minusSeconds(600))));

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		verify(accounts).seen(1);
	}

	private static Account seen(Instant at) {
		return new Account(1, "yona@example.fr", "Yona", AccountStatus.ACTIVE, 0, null, Instant.EPOCH, null, null, null, at);
	}

	@Test
	void dropsASessionThatIsNotAnAdmins() throws Exception {
		// A Google sign-in of before 2.19, kept by a server that never stopped: not an admin of the accounts
		SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("someone", null, "ROLE_ADMIN"));
		request.setSession(session);

		filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		assertThat(session.isInvalid()).isTrue();
	}

}
