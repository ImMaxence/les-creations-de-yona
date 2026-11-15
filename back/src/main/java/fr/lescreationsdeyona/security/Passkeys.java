package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.webauthn.api.AuthenticatorAssertionResponse;
import org.springframework.security.web.webauthn.api.AuthenticatorSelectionCriteria;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.PublicKeyCredential;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRpEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.ResidentKeyRequirement;
import org.springframework.security.web.webauthn.api.UserVerificationRequirement;
import org.springframework.security.web.webauthn.jackson.WebauthnJacksonModule;
import org.springframework.security.web.webauthn.management.ImmutablePublicKeyCredentialCreationOptionsRequest;
import org.springframework.security.web.webauthn.management.ImmutablePublicKeyCredentialRequestOptionsRequest;
import org.springframework.security.web.webauthn.management.ImmutableRelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyAuthenticationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyPublicKey;
import org.springframework.security.web.webauthn.management.Webauthn4JRelyingPartyOperations;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The two ceremonies of WebAuthn, made by Spring Security and WebAuthn4J: making a passkey, signing in
 * with one. The challenge waits in the session between the two requests of each; the JSON is the one of
 * the browser's API, read and written with Spring Security's own Jackson module.
 */
@Service
class Passkeys {

	private static final Logger log = LoggerFactory.getLogger(Passkeys.class);

	private static final String CREATION = Passkeys.class.getName() + ".CREATION";

	private static final String REQUEST = Passkeys.class.getName() + ".REQUEST";

	private static final TypeReference<PublicKeyCredential<AuthenticatorAssertionResponse>> ASSERTION = new TypeReference<>() {
	};

	private final Webauthn4JRelyingPartyOperations operations;

	private final JsonMapper json = JsonMapper.builder().addModule(new WebauthnJacksonModule()).build();

	Passkeys(PasskeyStore.Users users, PasskeyStore.Credentials credentials, AuthProperties properties,
			@Value("${app.site-url}") URI siteUrl) {
		List<String> origins = properties.passkeyOrigins().isEmpty() ? List.of(origin(siteUrl)) : properties.passkeyOrigins();
		// A passkey is made for a domain: the one of the first address (localhost on a computer)
		String rpId = URI.create(origins.getFirst()).getHost();
		this.operations = new Webauthn4JRelyingPartyOperations(users, credentials,
				PublicKeyCredentialRpEntity.builder().id(rpId).name("Les créations de Yona").build(), new LinkedHashSet<>(origins));
		// The only key of an admin account: the device must check who holds it (fingerprint, face, code), not just a touch
		this.operations.setCustomizeCreationOptions(options -> options.authenticatorSelection(AuthenticatorSelectionCriteria.builder()
			.residentKey(ResidentKeyRequirement.REQUIRED)
			.userVerification(UserVerificationRequirement.REQUIRED)
			.build()));
		this.operations.setCustomizeRequestOptions(options -> options.userVerification(UserVerificationRequirement.REQUIRED));
	}

	/** What the browser needs to make a passkey for this account, as JSON; the challenge stays in the session. */
	String creationOptions(Account account, HttpSession session) {
		// Spring Security names the WebAuthn user after the authentication: the address of the account
		var authentication = UsernamePasswordAuthenticationToken.authenticated(account.email(), null, List.of());
		PublicKeyCredentialCreationOptions options = operations
			.createPublicKeyCredentialCreationOptions(new ImmutablePublicKeyCredentialCreationOptionsRequest(authentication));
		session.setAttribute(CREATION, new Pending<>(account.id(), options));
		return write(options);
	}

	/**
	 * The passkey the browser made ({@code {"credential": …, "label": "iPhone"}}), checked against the
	 * challenge of this account: kept, with its name. Refused when no challenge waits for this account
	 * (expired session, another tab).
	 */
	CredentialRecord register(Account account, String body, HttpSession session) {
		Pending<PublicKeyCredentialCreationOptions> pending = take(session, CREATION);
		if (pending == null || pending.accountId() != account.id()) {
			throw new ApiException(ErrorCode.PASSKEY_EXPIRED);
		}
		try {
			RelyingPartyPublicKey sent = json.readValue(body, RelyingPartyPublicKey.class);
			return operations.registerCredential(new ImmutableRelyingPartyRegistrationRequest(pending.options(),
					new RelyingPartyPublicKey(sent.getCredential(), PasskeyStore.Credentials.label(sent.getLabel()))));
		}
		catch (RuntimeException ex) {
			log.warn("Passkey not created for {}: {}", account.email(), ex.getMessage());
			throw new ApiException(ErrorCode.PASSKEY_NOT_CREATED, ex);
		}
	}

	/** What the browser needs to sign in with any passkey of the site (it offers those it holds). */
	String requestOptions(HttpSession session) {
		PublicKeyCredentialRequestOptions options = operations
			.createCredentialRequestOptions(new ImmutablePublicKeyCredentialRequestOptionsRequest(null));
		session.setAttribute(REQUEST, new Pending<>(0, options));
		return write(options);
	}

	/** The address of the account whose passkey signed the challenge; empty when it does not check out. */
	Optional<String> authenticate(String assertionJson, HttpSession session) {
		Pending<PublicKeyCredentialRequestOptions> pending = take(session, REQUEST);
		if (pending == null) {
			throw new ApiException(ErrorCode.PASSKEY_EXPIRED);
		}
		try {
			PublicKeyCredential<AuthenticatorAssertionResponse> assertion = json.readValue(assertionJson, ASSERTION);
			PublicKeyCredentialUserEntity user = operations.authenticate(new RelyingPartyAuthenticationRequest(pending.options(), assertion));
			return Optional.of(user.getName());
		}
		catch (RuntimeException ex) {
			// A passkey deleted since, of another site, or a signature that does not match
			log.warn("Passkey sign-in refused: {}", ex.getMessage());
			return Optional.empty();
		}
	}

	private String write(Object options) {
		return json.writeValueAsString(options);
	}

	@SuppressWarnings("unchecked")
	private static <T> @Nullable Pending<T> take(HttpSession session, String name) {
		Object pending = session.getAttribute(name);
		session.removeAttribute(name);
		return pending instanceof Pending<?> found ? (Pending<T>) found : null;
	}

	private static String origin(URI url) {
		return url.getScheme() + "://" + url.getAuthority();
	}

	/** A challenge waiting for its answer, and the account it is for (0 to sign in). */
	private record Pending<T>(long accountId, T options) implements java.io.Serializable {
	}

}
