package fr.lescreationsdeyona.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class WebPushCryptoTest {

	@Test
	void keysSurviveTheirEncoding() throws GeneralSecurityException {
		KeyPair keys = WebPushCrypto.generateKeyPair();
		byte[] publicKey = WebPushCrypto.encode((ECPublicKey) keys.getPublic());
		byte[] privateKey = WebPushCrypto.encode((ECPrivateKey) keys.getPrivate());

		assertThat(publicKey).hasSize(65).startsWith(4);
		assertThat(privateKey).hasSize(32);
		assertThat(WebPushCrypto.encode(WebPushCrypto.decodePublicKey(publicKey))).isEqualTo(publicKey);
		assertThat(WebPushCrypto.encode(WebPushCrypto.decodePrivateKey(privateKey))).isEqualTo(privateKey);
	}

	@Test
	void refusesAKeyThatIsNotAnUncompressedPoint() {
		assertThatThrownBy(() -> WebPushCrypto.decodePublicKey(new byte[33]))
			.isInstanceOf(GeneralSecurityException.class);
	}

	@Test
	void readsBase64UrlWithOrWithoutPadding() {
		byte[] bytes = { (byte) 0xfb, (byte) 0xff, 0x01 };
		assertThat(WebPushCrypto.base64Url(bytes)).isEqualTo("-_8B");
		assertThat(WebPushCrypto.fromBase64Url("-_8B")).isEqualTo(bytes);
		assertThat(WebPushCrypto.fromBase64Url("AQ==")).containsExactly(1);
	}

	/** What the browser does with the body (RFC 8291): only the subscribed one can read it. */
	@Test
	void encryptsAPayloadTheBrowserCanDecrypt() throws GeneralSecurityException {
		KeyPair browser = WebPushCrypto.generateKeyPair();
		byte[] browserKey = WebPushCrypto.encode((ECPublicKey) browser.getPublic());
		byte[] authSecret = new byte[16];
		new SecureRandom().nextBytes(authSecret);
		byte[] payload = "{\"notification\":{\"title\":\"Tarte au citron\"}}".getBytes(StandardCharsets.UTF_8);

		byte[] body = WebPushCrypto.encrypt(payload, browserKey, authSecret);

		assertThat(decrypt(body, browser, browserKey, authSecret)).isEqualTo(payload);
		// Another browser's secret does not open it
		byte[] otherSecret = authSecret.clone();
		otherSecret[0] ^= 1;
		assertThatThrownBy(() -> decrypt(body, browser, browserKey, otherSecret))
			.isInstanceOf(GeneralSecurityException.class);
	}

	@Test
	void signsAVapidTokenThePushServiceCanVerify() throws GeneralSecurityException {
		KeyPair site = WebPushCrypto.generateKeyPair();
		String token = WebPushCrypto.vapidToken("https://fcm.googleapis.com", "https://les-creations-de-yona.fr",
				1_800_000_000L, (ECPrivateKey) site.getPrivate());

		String[] parts = token.split("\\.");
		assertThat(parts).hasSize(3);
		assertThat(new String(WebPushCrypto.fromBase64Url(parts[0]), StandardCharsets.UTF_8))
			.isEqualTo("{\"typ\":\"JWT\",\"alg\":\"ES256\"}");
		assertThat(new String(WebPushCrypto.fromBase64Url(parts[1]), StandardCharsets.UTF_8)).isEqualTo(
				"{\"aud\":\"https://fcm.googleapis.com\",\"exp\":1800000000,\"sub\":\"https://les-creations-de-yona.fr\"}");
		byte[] signature = WebPushCrypto.fromBase64Url(parts[2]);
		assertThat(signature).hasSize(64);

		Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
		verifier.initVerify(site.getPublic());
		verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
		assertThat(verifier.verify(signature)).isTrue();
	}

	private static byte[] decrypt(byte[] body, KeyPair browser, byte[] browserKey, byte[] authSecret)
			throws GeneralSecurityException {
		ByteBuffer header = ByteBuffer.wrap(body);
		byte[] salt = new byte[16];
		header.get(salt);
		assertThat(header.getInt()).isEqualTo(4096);
		byte[] serverKey = new byte[header.get()];
		header.get(serverKey);
		byte[] encrypted = Arrays.copyOfRange(body, header.position(), body.length);

		KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
		agreement.init(browser.getPrivate());
		agreement.doPhase(WebPushCrypto.decodePublicKey(serverKey), true);
		byte[] sharedSecret = agreement.generateSecret();

		byte[] keyPrk = hmac(authSecret, sharedSecret);
		byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), browserKey, serverKey,
				new byte[] { 1 });
		byte[] inputKey = hmac(keyPrk, keyInfo);
		byte[] prk = hmac(salt, inputKey);
		byte[] contentKey = Arrays.copyOf(hmac(prk, label("Content-Encoding: aes128gcm\0")), 16);
		byte[] nonce = Arrays.copyOf(hmac(prk, label("Content-Encoding: nonce\0")), 12);

		Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
		cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(contentKey, "AES"), new GCMParameterSpec(128, nonce));
		byte[] record = cipher.doFinal(encrypted);
		// The last record ends with its 0x02 delimiter
		assertThat(record[record.length - 1]).isEqualTo((byte) 2);
		return Arrays.copyOf(record, record.length - 1);
	}

	private static byte[] label(String text) {
		return concat(text.getBytes(StandardCharsets.US_ASCII), new byte[] { 1 });
	}

	private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(key, "HmacSHA256"));
		return mac.doFinal(data);
	}

	private static byte[] concat(byte[]... parts) {
		ByteBuffer joined = ByteBuffer.allocate(Arrays.stream(parts).mapToInt(part -> part.length).sum());
		for (byte[] part : parts) {
			joined.put(part);
		}
		return joined.array();
	}

}
