package fr.lescreationsdeyona.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import org.jspecify.annotations.Nullable;

/**
 * Why the browser leaves for Google or Microsoft, kept in the session until it comes back: to link that
 * account to the admin signed in ("Mon compte"), or to come in with a link ({@code token}). Nothing: an
 * ordinary sign-in.
 */
sealed interface SignInIntent extends Serializable {

	String ATTRIBUTE = SignInIntent.class.getName();

	/** "Lier" in "Mon compte": the account of the admin signed in. */
	record Link(long accountId) implements SignInIntent {
	}

	/** An invitation or a recovery link. */
	record Access(String token) implements SignInIntent {
	}

	/** {@code null} forgets the one before: a plain sign-in. */
	static void remember(HttpServletRequest request, @Nullable SignInIntent intent) {
		if (intent != null) {
			request.getSession(true).setAttribute(ATTRIBUTE, intent);
		}
		else {
			HttpSession session = request.getSession(false);
			if (session != null) {
				session.removeAttribute(ATTRIBUTE);
			}
		}
	}

	/** Read once: the next sign-in starts afresh. */
	static @Nullable SignInIntent take(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) {
			return null;
		}
		Object intent = session.getAttribute(ATTRIBUTE);
		session.removeAttribute(ATTRIBUTE);
		return intent instanceof SignInIntent found ? found : null;
	}

}
