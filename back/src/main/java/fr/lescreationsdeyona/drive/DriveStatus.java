package fr.lescreationsdeyona.drive;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** The Google Drive backups, as the back-office shows them. */
public record DriveStatus(boolean connected,
		@Schema(description = "Google account receiving the backups") @Nullable String accountEmail,
		@Schema(description = "The backups folder, on drive.google.com") @Nullable String folderUrl,
		@Nullable Instant connectedAt,
		@Schema(description = "A backup is being made right now") boolean running,
		@Nullable Instant lastBackupAt, @Nullable Boolean lastBackupOk,
		@Schema(description = "Why the last backup failed, in French") @Nullable String lastBackupError,
		@Nullable String lastBackupFile, @Nullable Long lastBackupBytes,
		@Schema(description = "Next nightly backup, when connected") @Nullable Instant nextBackupAt,
		@Schema(description = "Backups kept on the Drive, the older ones deleted") int keptBackups) {
}
