package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;

class AuthControllerTest {

	private final AuthController controller = new AuthController();

	private final CsrfToken csrfToken = mock(CsrfToken.class);

	private OidcUser admin(String picture) {
		OidcUser admin = mock(OidcUser.class);
		when(admin.getEmail()).thenReturn("yona@example.fr");
		when(admin.getFullName()).thenReturn("Yona");
		when(admin.getPicture()).thenReturn(picture);
		return admin;
	}

	@Test
	void givesThePhotoOfTheGoogleAccount() {
		String picture = "https://lh3.googleusercontent.com/a/photo";

		assertThat(controller.getCurrentAdmin(admin(picture), csrfToken)).isEqualTo(new AdminResponse("yona@example.fr", "Yona", picture));
	}

	@Test
	void hasNoPhotoForAnAccountWithoutOne() {
		assertThat(controller.getCurrentAdmin(admin(null), csrfToken).picture()).isNull();
	}

	@Test
	void writesTheCsrfCookieForTheBackOffice() {
		controller.getCurrentAdmin(admin(null), csrfToken);

		verify(csrfToken).getToken();
	}

}
