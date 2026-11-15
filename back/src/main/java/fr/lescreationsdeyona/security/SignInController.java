package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountResponses.AccessLinkPage;
import fr.lescreationsdeyona.security.AccountResponses.SignInMethods;
import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Coming in without a session: with a passkey, or with a link (invitation, recovery). Google and
 * Microsoft go through Spring Security ({@code /api/oauth2/authorization/…}, {@link OAuthSignIn}).
 * <p>
 * The passkey routes speak the JSON of the browser's WebAuthn API (base64url), out of the OpenAPI
 * description: the front calls them itself ({@code core/auth/passkeys.ts}).
 */
@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/auth")
class SignInController {

	private final AccountManagement management;

	private final AdminAccounts accounts;

	private final AccessLinks links;

	private final Passkeys passkeys;

	private final AccountSignIn signIn;

	SignInController(AccountManagement management, AdminAccounts accounts, AccessLinks links, Passkeys passkeys, AccountSignIn signIn) {
		this.management = management;
		this.accounts = accounts;
		this.links = links;
		this.passkeys = passkeys;
		this.signIn = signIn;
	}

	@Operation(summary = "The ways to sign in offered: Google, Microsoft when set up (passkeys always)")
	@GetMapping("/methods")
	SignInMethods getSignInMethods() {
		return management.methods();
	}

	@Hidden
	@PostMapping(path = "/passkey/options", produces = MediaType.APPLICATION_JSON_VALUE)
	String passkeySignInOptions(HttpServletRequest request) {
		return passkeys.requestOptions(request.getSession(true));
	}

	@Hidden
	@PostMapping(path = "/passkey", consumes = MediaType.APPLICATION_JSON_VALUE)
	Map<String, String> signInWithPasskey(@RequestBody String assertion, HttpServletRequest request, HttpServletResponse response) {
		Account account = passkeys.authenticate(assertion, request.getSession(true))
			.flatMap(signIn::withPasskey)
			.orElseThrow(() -> new ApiException(ErrorCode.PASSKEY_REFUSED));
		signIn.start(account, request, response);
		return Map.of("redirectUrl", "/admin");
	}

	@Operation(summary = "A link to come in once (invitation, recovery): who it is for; 404 when used, replaced or expired")
	@GetMapping("/access-links/{token}")
	AccessLinkPage getAccessLink(@PathVariable String token) {
		AccessLink link = link(token);
		Account account = account(link);
		return new AccessLinkPage(account.email(), account.name(), link.purpose(), link.expiresAt(), management.methods());
	}

	@Hidden
	@PostMapping(path = "/access-links/{token}/passkey/options", produces = MediaType.APPLICATION_JSON_VALUE)
	String accessLinkPasskeyOptions(@PathVariable String token, HttpServletRequest request) {
		return passkeys.creationOptions(account(link(token)), request.getSession(true));
	}

	/** The passkey made with the link: the link is used, the admin in. */
	@Hidden
	@PostMapping(path = "/access-links/{token}/passkey", consumes = MediaType.APPLICATION_JSON_VALUE)
	Map<String, String> createPasskeyWithAccessLink(@PathVariable String token, @RequestBody String credential, HttpServletRequest request,
			HttpServletResponse response) {
		AccessLink link = link(token);
		Account account = account(link);
		passkeys.register(account, credential, request.getSession(true));
		Account arrived = signIn.withLinkAndPasskey(account, link);
		signIn.start(arrived, request, response);
		return Map.of("redirectUrl", AccountSignIn.landing(link));
	}

	private AccessLink link(String token) {
		return links.find(token).orElseThrow(() -> new ApiException(ErrorCode.ACCESS_LINK_INVALID));
	}

	private Account account(AccessLink link) {
		Account account = accounts.find(link.accountId()).orElseThrow(() -> new ApiException(ErrorCode.ACCESS_LINK_INVALID));
		if (account.status() == AccountStatus.DISABLED) {
			throw new ApiException(ErrorCode.ACCOUNT_DISABLED);
		}
		return account;
	}

}
