package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.security.web.csrf.CsrfToken;

class AuthControllerTest {

	private final AuthController controller = new AuthController();

	private final CsrfToken csrfToken = mock(CsrfToken.class);

	@Test
	void givesTheAdminAsTheirAccountSaysIt() {
		AdminPrincipal yona = new AdminPrincipal(3, "yona@example.fr", "Yona", "/api/admin/accounts/3/photo?v=2");

		assertThat(controller.getCurrentAdmin(yona, csrfToken))
			.isEqualTo(new AdminResponse(3, "yona@example.fr", "Yona", "/api/admin/accounts/3/photo?v=2"));
	}

	@Test
	void hasNoPhotoForAnAccountWithoutOne() {
		assertThat(controller.getCurrentAdmin(new AdminPrincipal(3, "yona@example.fr", "Yona", null), csrfToken).picture()).isNull();
	}

	@Test
	void writesTheCsrfCookieForTheBackOffice() {
		controller.getCurrentAdmin(new AdminPrincipal(3, "yona@example.fr", "Yona", null), csrfToken);

		verify(csrfToken).getToken();
	}

}
