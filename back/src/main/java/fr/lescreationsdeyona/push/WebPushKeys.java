package fr.lescreationsdeyona.push;

import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The site's VAPID key pair, created at the first use and kept in the database: browsers subscribe
 * with the public key, and only accept notifications signed with the private one. Never replaced:
 * a new pair would silence every subscription.
 */
@Component
class WebPushKeys {

	private final JdbcClient jdbc;

	private volatile @Nullable Keys keys;

	WebPushKeys(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record Keys(String publicKey, ECPrivateKey privateKey) {
	}

	Keys get() {
		Keys current = keys;
		if (current == null) {
			synchronized (this) {
				current = keys;
				if (current == null) {
					current = load();
					keys = current;
				}
			}
		}
		return current;
	}

	private Keys load() {
		KeyPair generated = WebPushCrypto.generateKeyPair();
		// Two backends starting together keep the same pair: the first one written
		jdbc.sql("""
				insert into web_push_key (id, public_key, private_key, created_at)
				values (1, :publicKey, :privateKey, :now) on conflict (id) do nothing""")
			.param("publicKey", WebPushCrypto.base64Url(WebPushCrypto.encode((ECPublicKey) generated.getPublic())))
			.param("privateKey", WebPushCrypto.base64Url(WebPushCrypto.encode((ECPrivateKey) generated.getPrivate())))
			.param("now", java.sql.Timestamp.from(Instant.now()))
			.update();
		Map<String, Object> row = jdbc.sql("select public_key, private_key from web_push_key where id = 1")
			.query()
			.singleRow();
		try {
			return new Keys((String) row.get("public_key"),
					WebPushCrypto.decodePrivateKey(WebPushCrypto.fromBase64Url((String) row.get("private_key"))));
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("Unreadable VAPID key in web_push_key", ex);
		}
	}

}
