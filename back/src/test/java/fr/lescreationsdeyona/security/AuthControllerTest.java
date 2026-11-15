package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.web.csrf.CsrfToken;

class AuthControllerTest {

	private final PasskeyStore.Credentials passkeys = mock(PasskeyStore.Credentials.class);

	private final AuthController controller = new AuthController(passkeys);

	private final CsrfToken csrfToken = mock(CsrfToken.class);

	@Test
	void givesTheAdminAsTheirAccountSaysIt() {
		AdminPrincipal yona = new AdminPrincipal(3, "yona@example.fr", "Yona", "/api/admin/accounts/3/photo?v=2");
		when(passkeys.count(3)).thenReturn(2);

		assertThat(controller.getCurrentAdmin(yona, csrfToken))
			.isEqualTo(new AdminResponse(3, "yona@example.fr", "Yona", "/api/admin/accounts/3/photo?v=2", 2));
	}

	@Test
	void hasNoPhotoForAnAccountWithoutOne() {
		assertThat(controller.getCurrentAdmin(new AdminPrincipal(3, "yona@example.fr", "Yona", null), csrfToken).picture()).isNull();
	}

	@Test
	void saysWhenTheAdminHasNoPasskeyYet() {
		// Mockito answers 0: the back-office reminds them to add one
		assertThat(controller.getCurrentAdmin(new AdminPrincipal(3, "yona@example.fr", "Yona", null), csrfToken).passkeys()).isZero();
	}

	@Test
	void writesTheCsrfCookieForTheBackOffice() {
		controller.getCurrentAdmin(new AdminPrincipal(3, "yona@example.fr", "Yona", null), csrfToken);

		verify(csrfToken).getToken();
	}

}
