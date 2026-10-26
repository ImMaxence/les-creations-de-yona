package fr.lescreationsdeyona.push;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Web Push with the JDK alone: payload encryption for the browser (RFC 8291, "aes128gcm" content
 * coding of RFC 8188) and the VAPID signature identifying the site to the push service (RFC 8292).
 * Keys are P-256, exchanged as base64url: public keys as uncompressed points (65 bytes), private
 * keys as their 32-byte scalar.
 */
final class WebPushCrypto {

	private static final ECParameterSpec P256 = p256();

	private static final SecureRandom RANDOM = new SecureRandom();

	/** A single record holds the whole payload: notifications are well under 4 KB. */
	private static final int RECORD_SIZE = 4096;

	private static final Base64.Encoder BASE64URL = Base64.getUrlEncoder().withoutPadding();

	private static final Base64.Decoder BASE64URL_DECODER = Base64.getUrlDecoder();

	private WebPushCrypto() {
	}

	static KeyPair generateKeyPair() {
		try {
			KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
			generator.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
			return generator.generateKeyPair();
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("P-256 keys unavailable", ex);
		}
	}

	/** Uncompressed point: 0x04, then x and y on 32 bytes each. */
	static byte[] encode(ECPublicKey key) {
		ByteBuffer point = ByteBuffer.allocate(65).put((byte) 4);
		point.put(unsigned32(key.getW().getAffineX())).put(unsigned32(key.getW().getAffineY()));
		return point.array();
	}

	static byte[] encode(ECPrivateKey key) {
		return unsigned32(key.getS());
	}

	/** @throws GeneralSecurityException not a P-256 point */
	static ECPublicKey decodePublicKey(byte[] point) throws GeneralSecurityException {
		if (point.length != 65 || point[0] != 4) {
			throw new GeneralSecurityException("Not an uncompressed P-256 point");
		}
		BigInteger x = new BigInteger(1, Arrays.copyOfRange(point, 1, 33));
		BigInteger y = new BigInteger(1, Arrays.copyOfRange(point, 33, 65));
		return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
	}

	static ECPrivateKey decodePrivateKey(byte[] scalar) throws GeneralSecurityException {
		return (ECPrivateKey) KeyFactory.getInstance("EC")
			.generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), P256));
	}

	/**
	 * The request body for one browser: a header (salt, record size, the server's ephemeral public
	 * key) followed by the payload encrypted with a key only that browser can derive.
	 *
	 * @param browserKey the subscription's {@code p256dh} (65 bytes)
	 * @param authSecret the subscription's {@code auth} (16 bytes)
	 */
	static byte[] encrypt(byte[] payload, byte[] browserKey, byte[] authSecret) throws GeneralSecurityException {
		KeyPair ephemeral = generateKeyPair();
		byte[] serverKey = encode((ECPublicKey) ephemeral.getPublic());
		KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
		agreement.init(ephemeral.getPrivate());
		agreement.doPhase(decodePublicKey(browserKey), true);
		byte[] sharedSecret = agreement.generateSecret();

		// RFC 8291, section 3.4
		byte[] keyPrk = hmac(authSecret, sharedSecret);
		byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), browserKey, serverKey);
		byte[] inputKey = hmac(keyPrk, concat(keyInfo, new byte[] { 1 }));
		byte[] salt = new byte[16];
		RANDOM.nextBytes(salt);
		byte[] prk = hmac(salt, inputKey);
		byte[] contentKey = Arrays.copyOf(hmac(prk, info("Content-Encoding: aes128gcm\0")), 16);
		byte[] nonce = Arrays.copyOf(hmac(prk, info("Content-Encoding: nonce\0")), 12);

		Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
		cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(contentKey, "AES"), new GCMParameterSpec(128, nonce));
		// 0x02: the delimiter of the last (and only) record, without padding
		byte[] encrypted = cipher.doFinal(concat(payload, new byte[] { 2 }));

		return ByteBuffer.allocate(16 + 4 + 1 + serverKey.length + encrypted.length)
			.put(salt)
			.putInt(RECORD_SIZE)
			.put((byte) serverKey.length)
			.put(serverKey)
			.put(encrypted)
			.array();
	}

	/**
	 * VAPID JWT (ES256) for the push service at {@code audience} (its origin), valid until
	 * {@code expiresAt} (epoch seconds, at most 24 hours ahead).
	 */
	static String vapidToken(String audience, String subject, long expiresAt, ECPrivateKey key)
			throws GeneralSecurityException {
		String header = base64Url("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
		String claims = base64Url(("{\"aud\":\"" + audience + "\",\"exp\":" + expiresAt + ",\"sub\":\"" + subject + "\"}")
			.getBytes(StandardCharsets.UTF_8));
		String signed = header + "." + claims;
		// JWS wants r and s side by side (64 bytes), not the DER encoding of the default algorithm
		Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
		signature.initSign(key);
		signature.update(signed.getBytes(StandardCharsets.US_ASCII));
		return signed + "." + base64Url(signature.sign());
	}

	static String base64Url(byte[] bytes) {
		return BASE64URL.encodeToString(bytes);
	}

	/** @throws IllegalArgumentException not base64url */
	static byte[] fromBase64Url(String text) {
		return BASE64URL_DECODER.decode(text.replace("=", ""));
	}

	private static byte[] info(String label) {
		return concat(label.getBytes(StandardCharsets.US_ASCII), new byte[] { 1 });
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

	/** Big-endian on exactly 32 bytes: BigInteger may add a sign byte or drop leading zeros. */
	private static byte[] unsigned32(BigInteger value) {
		byte[] bytes = value.toByteArray();
		byte[] fixed = new byte[32];
		int length = Math.min(bytes.length, 32);
		System.arraycopy(bytes, bytes.length - length, fixed, 32 - length, length);
		return fixed;
	}

	private static ECParameterSpec p256() {
		try {
			AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
			parameters.init(new ECGenParameterSpec("secp256r1"));
			return parameters.getParameterSpec(ECParameterSpec.class);
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("P-256 curve unavailable", ex);
		}
	}

}
