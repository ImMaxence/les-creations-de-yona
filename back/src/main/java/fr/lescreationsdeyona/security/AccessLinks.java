package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.AccessLink;
import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * The links that let an admin in once, to choose a way to sign in: an invitation, or a recovery link.
 * The token is 256 random bits, given once; only its SHA-256 is kept. A new link replaces the one before.
 */
@Service
class AccessLinks {

	static final Duration INVITATION_VALIDITY = Duration.ofDays(7);

	static final Duration RECOVERY_VALIDITY = Duration.ofDays(1);

	/** The one written in the server's logs at start-up: whoever reads them can sign in. */
	static final Duration SERVER_RECOVERY_VALIDITY = Duration.ofHours(1);

	private static final SecureRandom RANDOM = new SecureRandom();

	private final JdbcClient jdbc;

	AccessLinks(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** A link just made: its token, to give to the admin, and when it expires. */
	record Issued(String token, AccessLink link) {
	}

	Issued issue(long accountId, AccessPurpose purpose, Duration validity, @Nullable String createdBy) {
		byte[] random = new byte[32];
		RANDOM.nextBytes(random);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
		Instant now = Instant.now();
		Instant expires = now.plus(validity);
		jdbc.sql("""
				insert into admin_access_link (account_id, token_hash, purpose, created_at, created_by, expires_at)
				values (:account, :hash, :purpose, :at, :by, :expires)
				on conflict (account_id) do update set token_hash = excluded.token_hash, purpose = excluded.purpose,
					created_at = excluded.created_at, created_by = excluded.created_by, expires_at = excluded.expires_at""")
			.param("account", accountId)
			.param("hash", hash(token))
			.param("purpose", purpose.name())
			.param("at", now.atOffset(ZoneOffset.UTC))
			.param("by", createdBy)
			.param("expires", expires.atOffset(ZoneOffset.UTC))
			.update();
		return new Issued(token, new AccessLink(accountId, purpose, now, expires));
	}

	/** The link of this token, if it has not expired. */
	Optional<AccessLink> find(String token) {
		if (token.length() > 100) {
			return Optional.empty();
		}
		return jdbc.sql("select account_id, purpose, created_at, expires_at from admin_access_link where token_hash = :hash and expires_at > :now")
			.param("hash", hash(token))
			.param("now", AdminAccounts.now())
			.query(AccessLinks::link)
			.optional();
	}

	/** The links not used yet, expired ones included (the page says so), by account. */
	Map<Long, AccessLink> pending() {
		Map<Long, AccessLink> links = new HashMap<>();
		jdbc.sql("select account_id, purpose, created_at, expires_at from admin_access_link")
			.query(AccessLinks::link)
			.list()
			.forEach(link -> links.put(link.accountId(), link));
		return links;
	}

	/** Used, or cancelled: it no longer lets anyone in. */
	void delete(long accountId) {
		jdbc.sql("delete from admin_access_link where account_id = :account").param("account", accountId).update();
	}

	static byte[] hash(String token) {
		try {
			return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static AccessLink link(ResultSet row, int index) throws SQLException {
		return new AccessLink(row.getLong("account_id"), AccessPurpose.valueOf(row.getString("purpose")),
				row.getObject("created_at", java.time.OffsetDateTime.class).toInstant(),
				row.getObject("expires_at", java.time.OffsetDateTime.class).toInstant());
	}

}
