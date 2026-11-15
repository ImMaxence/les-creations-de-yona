package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.Passkey;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.web.webauthn.api.AuthenticatorTransport;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutableCredentialRecord;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCose;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialType;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.stereotype.Component;

/**
 * Where Spring Security keeps the passkeys: the "user" of WebAuthn is an admin account (its
 * {@code passkey_handle}, its address as name), each passkey a row of {@code admin_passkey}.
 */
final class PasskeyStore {

	private PasskeyStore() {
	}

	/** The admins as WebAuthn knows them: a random handle, their address, their name. */
	@Component
	static class Users implements PublicKeyCredentialUserEntityRepository {

		private final JdbcClient jdbc;

		Users(JdbcClient jdbc) {
			this.jdbc = jdbc;
		}

		@Override
		public @Nullable PublicKeyCredentialUserEntity findById(Bytes id) {
			return jdbc.sql("select email, name, passkey_handle from admin_account where passkey_handle = :handle")
				.param("handle", id.getBytes())
				.query(Users::entity)
				.optional()
				.orElse(null);
		}

		@Override
		public @Nullable PublicKeyCredentialUserEntity findByUsername(String username) {
			return jdbc.sql("select email, name, passkey_handle from admin_account where email = :email and passkey_handle is not null")
				.param("email", username)
				.query(Users::entity)
				.optional()
				.orElse(null);
		}

		/** Its first passkey: the account receives its handle. */
		@Override
		public void save(PublicKeyCredentialUserEntity userEntity) {
			jdbc.sql("update admin_account set passkey_handle = :handle where email = :email and passkey_handle is null")
				.param("handle", userEntity.getId().getBytes())
				.param("email", userEntity.getName())
				.update();
		}

		@Override
		public void delete(Bytes id) {
			jdbc.sql("update admin_account set passkey_handle = null where passkey_handle = :handle").param("handle", id.getBytes()).update();
		}

		private static PublicKeyCredentialUserEntity entity(ResultSet row, int index) throws SQLException {
			String email = row.getString("email");
			String name = row.getString("name");
			return ImmutablePublicKeyCredentialUserEntity.builder()
				.id(new Bytes(row.getBytes("passkey_handle")))
				.name(email)
				.displayName(name == null ? email : name)
				.build();
		}

	}

	/** The passkeys themselves: their public key, their counter, when they were made and last used. */
	@Component
	static class Credentials implements UserCredentialRepository {

		private static final String COLUMNS = """
				p.credential_id, p.label, p.credential_type, p.public_key, p.signature_count, p.uv_initialized, p.backup_eligible,
				p.backup_state, p.transports, p.attestation_object, p.attestation_client_data_json, p.created_at, p.last_used_at,
				a.passkey_handle""";

		private final JdbcClient jdbc;

		Credentials(JdbcClient jdbc) {
			this.jdbc = jdbc;
		}

		/** A new passkey, or one just used (its counter and the date). */
		@Override
		public void save(CredentialRecord record) {
			Instant created = record.getCreated() == null ? Instant.now() : record.getCreated();
			jdbc.sql("""
					insert into admin_passkey (credential_id, account_id, label, credential_type, public_key, signature_count,
						uv_initialized, backup_eligible, backup_state, transports, attestation_object, attestation_client_data_json,
						created_at, last_used_at)
					select :id, a.id, :label, :type, :key, :count, :uv, :eligible, :state, :transports, :attestation, :clientData,
						:created, :used
					from admin_account a where a.passkey_handle = :handle
					on conflict (credential_id) do update set signature_count = excluded.signature_count,
						uv_initialized = excluded.uv_initialized, backup_state = excluded.backup_state, last_used_at = excluded.last_used_at""")
				.param("id", record.getCredentialId().getBytes())
				.param("label", label(record.getLabel()))
				.param("type", record.getCredentialType().getValue())
				.param("key", record.getPublicKey().getBytes())
				.param("count", record.getSignatureCount())
				.param("uv", record.isUvInitialized())
				.param("eligible", record.isBackupEligible())
				.param("state", record.isBackupState())
				.param("transports", record.getTransports().stream().map(AuthenticatorTransport::getValue).sorted().collect(Collectors.joining(",")))
				.param("attestation", record.getAttestationObject() == null ? null : record.getAttestationObject().getBytes())
				.param("clientData", record.getAttestationClientDataJSON() == null ? null : record.getAttestationClientDataJSON().getBytes())
				.param("created", created.atOffset(ZoneOffset.UTC))
				.param("used", record.getLastUsed() == null ? null : record.getLastUsed().atOffset(ZoneOffset.UTC))
				.param("handle", record.getUserEntityUserId().getBytes())
				.update();
		}

		@Override
		public @Nullable CredentialRecord findByCredentialId(Bytes credentialId) {
			return jdbc.sql("select " + COLUMNS + " from admin_passkey p join admin_account a on a.id = p.account_id where p.credential_id = :id")
				.param("id", credentialId.getBytes())
				.query(Credentials::record)
				.optional()
				.orElse(null);
		}

		@Override
		public List<CredentialRecord> findByUserId(Bytes userId) {
			return jdbc.sql("select " + COLUMNS + " from admin_passkey p join admin_account a on a.id = p.account_id where a.passkey_handle = :handle")
				.param("handle", userId.getBytes())
				.query(Credentials::record)
				.list();
		}

		@Override
		public void delete(Bytes credentialId) {
			jdbc.sql("delete from admin_passkey where credential_id = :id").param("id", credentialId.getBytes()).update();
		}

		// For "Mon compte" and "Utilisateurs"

		List<Passkey> of(long accountId) {
			return jdbc.sql("select account_id, credential_id, label, backup_state, created_at, last_used_at from admin_passkey where account_id = :id order by created_at")
				.param("id", accountId)
				.query(Credentials::passkey)
				.list();
		}

		Map<Long, Integer> countByAccount() {
			Map<Long, Integer> counts = new HashMap<>();
			jdbc.sql("select account_id, count(*) as n from admin_passkey group by account_id")
				.query((row, index) -> Map.entry(row.getLong("account_id"), row.getInt("n")))
				.list()
				.forEach(entry -> counts.put(entry.getKey(), entry.getValue()));
			return counts;
		}

		/** False when this passkey is not one of the account's. */
		boolean rename(long accountId, Bytes credentialId, String label) {
			return jdbc.sql("update admin_passkey set label = :label where account_id = :account and credential_id = :id")
				.param("label", label(label))
				.param("account", accountId)
				.param("id", credentialId.getBytes())
				.update() == 1;
		}

		boolean delete(long accountId, Bytes credentialId) {
			return jdbc.sql("delete from admin_passkey where account_id = :account and credential_id = :id")
				.param("account", accountId)
				.param("id", credentialId.getBytes())
				.update() == 1;
		}

		/** The name typed, on one line, 60 characters at most; "Passkey" without one. */
		static String label(@Nullable String label) {
			if (label == null || label.isBlank()) {
				return "Passkey";
			}
			String line = label.strip().replaceAll("\\s+", " ");
			return line.length() > 60 ? line.substring(0, 60).strip() : line;
		}

		private static CredentialRecord record(ResultSet row, int index) throws SQLException {
			byte[] attestation = row.getBytes("attestation_object");
			byte[] clientData = row.getBytes("attestation_client_data_json");
			Instant used = AdminAccounts.instant(row, "last_used_at");
			String transports = row.getString("transports");
			Set<AuthenticatorTransport> parsed = transports.isEmpty() ? Set.of()
					: Arrays.stream(transports.split(",")).map(AuthenticatorTransport::valueOf).collect(Collectors.toUnmodifiableSet());
			return ImmutableCredentialRecord.builder()
				.credentialId(new Bytes(row.getBytes("credential_id")))
				.userEntityUserId(new Bytes(row.getBytes("passkey_handle")))
				.label(row.getString("label"))
				.credentialType(PublicKeyCredentialType.valueOf(row.getString("credential_type")))
				.publicKey(new ImmutablePublicKeyCose(row.getBytes("public_key")))
				.signatureCount(row.getLong("signature_count"))
				.uvInitialized(row.getBoolean("uv_initialized"))
				.backupEligible(row.getBoolean("backup_eligible"))
				.backupState(row.getBoolean("backup_state"))
				.transports(parsed)
				.attestationObject(attestation == null ? null : new Bytes(attestation))
				.attestationClientDataJSON(clientData == null ? null : new Bytes(clientData))
				.created(AdminAccounts.instant(row, "created_at"))
				.lastUsed(used)
				.build();
		}

		private static Passkey passkey(ResultSet row, int index) throws SQLException {
			return new Passkey(row.getLong("account_id"), new Bytes(row.getBytes("credential_id")).toBase64UrlString(), row.getString("label"),
					row.getBoolean("backup_state"), AdminAccounts.instant(row, "created_at"), AdminAccounts.instant(row, "last_used_at"));
		}

	}

}
