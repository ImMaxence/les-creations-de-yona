package fr.lescreationsdeyona.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * A session opened before signing in (the challenge of a passkey, the way to Google or Microsoft) lives
 * 10 minutes without use: anyone can open one, and they are kept in memory. Signed in, it gets the usual
 * life of an admin's session ({@code server.servlet.session.timeout}, 7 days without use).
 */
@Component
class SessionLifetime implements HttpSessionListener {

	static final Duration BEFORE_SIGN_IN = Duration.ofMinutes(10);

	@Override
	public void sessionCreated(HttpSessionEvent event) {
		event.getSession().setMaxInactiveInterval((int) BEFORE_SIGN_IN.toSeconds());
	}

	/** The admin is in: their session lives as long as the server gives one. */
	static void signedIn(HttpServletRequest request) {
		HttpSession session = request.getSession(true);
		int minutes = request.getServletContext().getSessionTimeout();
		// 0 would mean never: kept at 10 minutes rather than that
		if (minutes > 0) {
			session.setMaxInactiveInterval((int) Duration.ofMinutes(minutes).toSeconds());
		}
	}

}
