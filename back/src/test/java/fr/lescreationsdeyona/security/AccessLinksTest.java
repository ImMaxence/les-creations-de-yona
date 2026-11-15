package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

class AccessLinksTest {

	@Test
	void keepsOnlyTheSha256OfAToken() {
		assertThat(HexFormat.of().formatHex(AccessLinks.hash("abc")))
			.isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	}

	@Test
	void looksForNoTokenTooLongToBeOne() {
		JdbcClient jdbc = mock(JdbcClient.class);

		assertThat(new AccessLinks(jdbc).find("x".repeat(200))).isEmpty();
		verifyNoInteractions(jdbc);
	}

	@Test
	void readsTheFirstAccountsAndTheWayBackIn() {
		AdminProperties properties = new AdminProperties(java.util.Set.of(" Yona@Example.fr ", ""), "  ");

		assertThat(properties.emails()).containsExactly("yona@example.fr");
		assertThat(properties.recoveryEmail()).isNull();
		assertThat(new AdminProperties(null, "Max@Example.fr").recoveryEmail()).isEqualTo("max@example.fr");
	}

}
