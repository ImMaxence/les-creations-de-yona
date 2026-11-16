package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * At each request of a signed-in admin, their account as it is now: disabled or deleted, the session
 * ends at once (on every device); a new name or photo, the session carries it. Any other session (one
 * of before 2.19, a sign-in through Google that never finished) is not an admin's: it is dropped. And
 * the admin was seen now ("Utilisateurs", 2.21), written every 5 minutes at most.
 */
class AdminAccountFilter extends OncePerRequestFilter {

	private final AdminAccounts accounts;

	private final SecurityContextRepository contextRepository;

	AdminAccountFilter(AdminAccounts accounts, SecurityContextRepository contextRepository) {
		this.accounts = accounts;
		this.contextRepository = contextRepository;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication instanceof AdminAuthentication admin) {
			Optional<Account> account = accounts.find(admin.getPrincipal().id()).filter(found -> found.status() == AccountStatus.ACTIVE);
			if (account.isEmpty()) {
				end(request);
			}
			else {
				if (!AdminPrincipal.of(account.get()).equals(admin.getPrincipal())) {
					SecurityContext context = SecurityContextHolder.createEmptyContext();
					context.setAuthentication(AdminAuthentication.of(account.get()));
					SecurityContextHolder.setContext(context);
					contextRepository.saveContext(context, request, response);
				}
				Instant seen = account.get().lastSeenAt();
				if (seen == null || seen.isBefore(Instant.now().minus(AdminAccounts.SEEN_EVERY))) {
					accounts.seen(account.get().id());
				}
			}
		}
		else if (authentication != null && !(authentication instanceof AnonymousAuthenticationToken)) {
			end(request);
		}
		chain.doFilter(request, response);
	}

	private static void end(HttpServletRequest request) {
		SecurityContextHolder.clearContext();
		HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
	}

}
