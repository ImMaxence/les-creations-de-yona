package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import fr.lescreationsdeyona.security.AccountTypes.SignInMethod;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Who comes in, once Google, Microsoft or a passkey has said who they are. An account is found by the
 * identifier its Google or Microsoft account has there (never by an address alone), with two exceptions,
 * both chosen by an admin beforehand: a link to come in once (invitation, recovery), and the first
 * sign-in of the accounts of {@code APP_ADMIN_EMAILS}, by the Google account of that verified address.
 */
@Service
class AccountSignIn {

	private static final Logger log = LoggerFactory.getLogger(AccountSignIn.class);

	/** Why someone was not let in: the end of the address of the page that says it. */
	enum Refusal {

		/** No admin has this Google or Microsoft account. */
		UNKNOWN("inconnu"),
		/** Their account is disabled. */
		DISABLED("desactive"),
		/** The link expired, was used, or replaced by a newer one. */
		LINK_EXPIRED("lien"),
		/** This Google or Microsoft account is already another admin's. */
		TAKEN("deja-pris"),
		/** Back from Google or Microsoft without an account: cancelled there, or the session expired on the way. */
		CANCELLED("annule");

		private final String slug;

		Refusal(String slug) {
			this.slug = slug;
		}

		String slug() {
			return slug;
		}

	}

	/** Who Google or Microsoft says it is: its identifier there, its address, its name, its photo (Google). */
	record ProviderAccount(IdentityProvider provider, String subject, @Nullable String email, boolean emailVerified,
			@Nullable String name, @Nullable String picture) {
	}

	/** In, and the page of the back-office to land on; or refused, and why. */
	sealed interface Outcome {

		record SignedIn(Account account, String landing) implements Outcome {
		}

		record Refused(Refusal refusal) implements Outcome {
		}

	}

	private final AdminAccounts accounts;

	private final AccessLinks links;

	private final SecurityContextRepository contextRepository;

	AccountSignIn(AdminAccounts accounts, AccessLinks links, SecurityContextRepository contextRepository) {
		this.accounts = accounts;
		this.links = links;
		this.contextRepository = contextRepository;
	}

	/** Back from Google or Microsoft, for an ordinary sign-in, to link that account, or with a link. */
	@Transactional
	Outcome withProvider(ProviderAccount who, @Nullable SignInIntent intent) {
		Optional<Account> owner = accounts.findByIdentity(who.provider(), who.subject());
		Outcome outcome = switch (intent) {
			case SignInIntent.Link link -> linkTo(link.accountId(), who, owner);
			case SignInIntent.Access access -> comeInWith(access.token(), who, owner);
			case null -> signIn(who, owner);
		};
		if (outcome instanceof Outcome.SignedIn signedIn) {
			accounts.used(who.provider(), who.subject(), who.email());
			accounts.signedIn(signedIn.account().id(), SignInMethod.of(who.provider()), who.name(), who.picture());
			return new Outcome.SignedIn(accounts.find(signedIn.account().id()).orElseThrow(), signedIn.landing());
		}
		log.warn("Back-office sign-in refused for the {} account {} ({})", who.provider(), who.email(), ((Outcome.Refused) outcome).refusal());
		return outcome;
	}

	private Outcome signIn(ProviderAccount who, Optional<Account> owner) {
		if (owner.isPresent()) {
			return owner.get().status() == AccountStatus.ACTIVE ? new Outcome.SignedIn(owner.get(), "/admin")
					: new Outcome.Refused(owner.get().status() == AccountStatus.DISABLED ? Refusal.DISABLED : Refusal.UNKNOWN);
		}
		// The accounts made from APP_ADMIN_EMAILS have no way in yet: the Google account of that address is theirs
		if (who.provider() == IdentityProvider.GOOGLE && who.emailVerified() && who.email() != null) {
			Optional<Account> first = accounts.findByEmail(who.email())
				.filter(account -> account.status() == AccountStatus.ACTIVE && accounts.methodCount(account.id()) == 0);
			if (first.isPresent()) {
				accounts.link(first.get().id(), who.provider(), who.subject(), who.email());
				log.info("Google account linked to {} at its first sign-in", first.get().email());
				return new Outcome.SignedIn(first.get(), "/admin");
			}
		}
		return new Outcome.Refused(Refusal.UNKNOWN);
	}

	private Outcome linkTo(long accountId, ProviderAccount who, Optional<Account> owner) {
		Optional<Account> account = accounts.find(accountId).filter(found -> found.status() == AccountStatus.ACTIVE);
		if (account.isEmpty()) {
			return new Outcome.Refused(Refusal.DISABLED);
		}
		String landing = "/admin/mon-compte?lie=" + who.provider().registrationId();
		if (owner.isPresent()) {
			return owner.get().id() == accountId ? new Outcome.SignedIn(account.get(), landing) : new Outcome.Refused(Refusal.TAKEN);
		}
		// Another Google account in place of the one before
		accounts.unlink(accountId, who.provider());
		accounts.link(accountId, who.provider(), who.subject(), who.email());
		log.info("{} account linked to {}", who.provider(), account.get().email());
		return new Outcome.SignedIn(account.get(), landing);
	}

	private Outcome comeInWith(String token, ProviderAccount who, Optional<Account> owner) {
		Optional<AccessLink> link = links.find(token);
		Optional<Account> account = link.flatMap(found -> accounts.find(found.accountId()));
		if (link.isEmpty() || account.isEmpty()) {
			return new Outcome.Refused(Refusal.LINK_EXPIRED);
		}
		if (account.get().status() == AccountStatus.DISABLED) {
			return new Outcome.Refused(Refusal.DISABLED);
		}
		if (owner.isPresent() && owner.get().id() != account.get().id()) {
			return new Outcome.Refused(Refusal.TAKEN);
		}
		if (owner.isEmpty()) {
			accounts.unlink(account.get().id(), who.provider());
			accounts.link(account.get().id(), who.provider(), who.subject(), who.email());
		}
		return new Outcome.SignedIn(arrived(account.get(), link.get()), landing(link.get()));
	}

	/** Came in with a passkey: its account, if it may sign in. */
	@Transactional
	Optional<Account> withPasskey(String email) {
		Optional<Account> account = accounts.findByEmail(email).filter(found -> found.status() == AccountStatus.ACTIVE);
		if (account.isEmpty()) {
			log.warn("Back-office sign-in refused for a passkey of {}: account disabled or gone", email);
			return Optional.empty();
		}
		accounts.signedIn(account.get().id(), SignInMethod.PASSKEY, null, null);
		return accounts.find(account.get().id());
	}

	/** A passkey made with a link: the link is used, the account active, and in. */
	@Transactional
	Account withLinkAndPasskey(Account account, AccessLink link) {
		Account arrived = arrived(account, link);
		accounts.signedIn(arrived.id(), SignInMethod.PASSKEY, null, null);
		return accounts.find(arrived.id()).orElseThrow();
	}

	/** Where a link leads once used: "Mon compte", to add another way in. */
	static String landing(AccessLink link) {
		return link.purpose() == AccessPurpose.INVITATION ? "/admin/mon-compte?bienvenue" : "/admin/mon-compte?recupere";
	}

	/** The link no longer lets anyone in; an invited admin becomes one. */
	private Account arrived(Account account, AccessLink link) {
		links.delete(link.accountId());
		if (account.status() == AccountStatus.INVITED) {
			accounts.setStatus(account.id(), AccountStatus.ACTIVE);
		}
		log.info("{} came in with a {} link", account.email(), link.purpose());
		return account;
	}

	/** In on this request: a new session id (no session fixation), the admin kept in it, for as long as an admin's session lasts. */
	void start(Account account, HttpServletRequest request, HttpServletResponse response) {
		request.getSession(true);
		request.changeSessionId();
		SessionLifetime.signedIn(request);
		keep(account, request, response);
	}

	/** The admin of this session again, without anything recorded (a link that failed, back to "Mon compte"). */
	void keep(Account account, HttpServletRequest request, HttpServletResponse response) {
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(AdminAuthentication.of(account));
		SecurityContextHolder.setContext(context);
		contextRepository.saveContext(context, request, response);
	}

}
