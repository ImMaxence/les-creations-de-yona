package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpSessionEvent;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockServletContext;

class SessionLifetimeTest {

	@Test
	void keepsASessionBeforeSignInTenMinutes() {
		MockHttpSession session = new MockHttpSession();

		new SessionLifetime().sessionCreated(new HttpSessionEvent(session));

		assertThat(session.getMaxInactiveInterval()).isEqualTo(600);
	}

	@Test
	void givesTheAdminTheUsualSevenDaysOnceIn() {
		MockServletContext context = new MockServletContext();
		context.setSessionTimeout(7 * 24 * 60);
		MockHttpServletRequest request = new MockHttpServletRequest(context);
		MockHttpSession session = new MockHttpSession(context);
		new SessionLifetime().sessionCreated(new HttpSessionEvent(session));
		request.setSession(session);

		SessionLifetime.signedIn(request);

		assertThat(session.getMaxInactiveInterval()).isEqualTo(7 * 24 * 3600);
	}

	@Test
	void neverMakesItEndless() {
		MockServletContext context = new MockServletContext();
		context.setSessionTimeout(0);
		MockHttpServletRequest request = new MockHttpServletRequest(context);
		MockHttpSession session = new MockHttpSession(context);
		new SessionLifetime().sessionCreated(new HttpSessionEvent(session));
		request.setSession(session);

		SessionLifetime.signedIn(request);

		assertThat(session.getMaxInactiveInterval()).isEqualTo(600);
	}

}
