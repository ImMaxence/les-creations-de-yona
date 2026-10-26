package fr.lescreationsdeyona.drive;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** The single row of {@code google_drive_link}: the connected account, and how the last backup went. */
@Component
class DriveLinkStore {

	private final JdbcClient jdbc;

	DriveLinkStore(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record DriveLink(String accountEmail, String refreshToken, @Nullable String folderId, Instant connectedAt,
			String connectedBy, @Nullable Instant lastBackupAt, @Nullable Boolean lastBackupOk,
			@Nullable String lastBackupError, @Nullable String lastBackupFile, @Nullable Long lastBackupBytes) {
	}

	Optional<DriveLink> find() {
		return jdbc.sql("""
				select account_email, refresh_token, folder_id, connected_at, connected_by, last_backup_at, last_backup_ok,
					last_backup_error, last_backup_file, last_backup_bytes
				from google_drive_link where id = 1""")
			.query((row, number) -> new DriveLink(row.getString("account_email"), row.getString("refresh_token"),
					row.getString("folder_id"), row.getTimestamp("connected_at").toInstant(), row.getString("connected_by"),
					instant(row.getTimestamp("last_backup_at")), (Boolean) row.getObject("last_backup_ok"),
					row.getString("last_backup_error"), row.getString("last_backup_file"),
					(Long) row.getObject("last_backup_bytes")))
			.optional();
	}

	/** Replaces the previous account, if any, and forgets its backups' history. */
	void connect(String accountEmail, String refreshToken, String folderId, String connectedBy) {
		jdbc.sql("delete from google_drive_link").update();
		jdbc.sql("""
				insert into google_drive_link (id, account_email, refresh_token, folder_id, connected_at, connected_by)
				values (1, :email, :token, :folder, :now, :by)""")
			.param("email", accountEmail)
			.param("token", refreshToken)
			.param("folder", folderId)
			.param("now", Timestamp.from(Instant.now()))
			.param("by", connectedBy)
			.update();
	}

	void updateFolder(String folderId) {
		jdbc.sql("update google_drive_link set folder_id = :folder where id = 1").param("folder", folderId).update();
	}

	void recordSuccess(String file, long bytes) {
		jdbc.sql("""
				update google_drive_link set last_backup_at = :now, last_backup_ok = true, last_backup_error = null,
					last_backup_file = :file, last_backup_bytes = :bytes
				where id = 1""")
			.param("now", Timestamp.from(Instant.now()))
			.param("file", file)
			.param("bytes", bytes)
			.update();
	}

	void recordFailure(String error) {
		jdbc.sql("""
				update google_drive_link set last_backup_at = :now, last_backup_ok = false, last_backup_error = :error
				where id = 1""")
			.param("now", Timestamp.from(Instant.now()))
			.param("error", error)
			.update();
	}

	void disconnect() {
		jdbc.sql("delete from google_drive_link").update();
	}

	private static @Nullable Instant instant(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

}
