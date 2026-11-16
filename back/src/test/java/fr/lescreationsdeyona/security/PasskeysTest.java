package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class PasskeysTest {

	private final PasskeyStore.Users users = mock(PasskeyStore.Users.class);

	private final PasskeyStore.Credentials credentials = mock(PasskeyStore.Credentials.class);

	private final MockHttpSession session = new MockHttpSession();

	private final Account yona = new Account(1, "yona@example.fr", "Yona", AccountStatus.ACTIVE, 0, null, Instant.EPOCH, null, null, null, null);

	private Passkeys passkeys(List<String> origins) {
		return new Passkeys(users, credentials, new AuthProperties(new AuthProperties.Provider("id", "secret"), null, origins),
				URI.create("https://les-creations-de-yona.fr"));
	}

	@Test
	void makesPasskeysForTheDomainOfTheSite() {
		JsonNode options = JsonMapper.shared().readTree(passkeys(List.of()).creationOptions(yona, session));

		assertThat(options.path("rp").path("id").asString()).isEqualTo("les-creations-de-yona.fr");
		assertThat(options.path("user").path("name").asString()).isEqualTo("yona@example.fr");
		// Kept by the device and offered there: signing in needs no address typed
		assertThat(options.path("authenticatorSelection").path("residentKey").asString()).isEqualTo("required");
		// The device checks who holds it (fingerprint, face, code), not a mere touch
		assertThat(options.path("authenticatorSelection").path("userVerification").asString()).isEqualTo("required");
		assertThat(options.path("challenge").asString()).isNotBlank();
		// Its first passkey: the account receives the random handle WebAuthn knows it by
		verify(users).save(any());
	}

	@Test
	void makesThemForLocalhostOnAComputer() {
		JsonNode options = JsonMapper.shared().readTree(passkeys(List.of("http://localhost:8000")).creationOptions(yona, session));

		assertThat(options.path("rp").path("id").asString()).isEqualTo("localhost");
	}

	@Test
	void asksForAnyPasskeyOfTheSiteToSignIn() {
		JsonNode options = JsonMapper.shared().readTree(passkeys(List.of()).requestOptions(session));

		assertThat(options.path("rpId").asString()).isEqualTo("les-creations-de-yona.fr");
		assertThat(options.path("allowCredentials").isEmpty()).isTrue();
		assertThat(options.path("userVerification").asString()).isEqualTo("required");
	}

	@Test
	void refusesAPasskeyWithoutAChallengeWaiting() {
		assertThatThrownBy(() -> passkeys(List.of()).register(yona, "{}", session)).extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.PASSKEY_EXPIRED);
	}

	@Test
	void refusesAChallengeMadeForAnotherAccount() {
		Passkeys passkeys = passkeys(List.of());
		passkeys.creationOptions(yona, session);
		Account max = new Account(2, "max@example.fr", "Max", AccountStatus.ACTIVE, 0, null, Instant.EPOCH, null, null, null, null);

		assertThatThrownBy(() -> passkeys.register(max, "{}", session)).extracting(ex -> ((ApiException) ex).getCode())
			.isEqualTo(ErrorCode.PASSKEY_EXPIRED);
	}

	@Test
	void letsNobodyInWithASignatureThatDoesNotCheckOut() {
		Passkeys passkeys = passkeys(List.of());
		passkeys.requestOptions(session);
		when(credentials.findByCredentialId(any())).thenReturn(null);

		assertThat(passkeys.authenticate("""
				{"id":"AQID","rawId":"AQID","type":"public-key","response":{"authenticatorData":"AQID","clientDataJSON":"AQID","signature":"AQID"},
				"clientExtensionResults":{}}""", session)).isEmpty();
		// The challenge is used once
		assertThatThrownBy(() -> passkeys.authenticate("{}", session)).isInstanceOf(ApiException.class);
	}

	@Test
	void namesAPasskeyOnOneShortLine() {
		assertThat(PasskeyStore.Credentials.label("  iPhone   de\nYona ")).isEqualTo("iPhone de Yona");
		assertThat(PasskeyStore.Credentials.label(null)).isEqualTo("Passkey");
		assertThat(PasskeyStore.Credentials.label("x".repeat(80))).hasSize(60);
	}

}
