package fr.lescreationsdeyona.drive;

import fr.lescreationsdeyona.backup.BackupService;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.AuditorAware;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Backups sent every night to the Google Drive of an admin: the same archive as "Sauvegarder mes
 * données", in a folder of its own; the 7 latest are kept, older ones deleted. The admin connects
 * the account once from the back-office (Google's consent page), and can disconnect it.
 */
@Service
public class DriveBackupService {

	static final int KEPT_BACKUPS = 7;

	private static final String FOLDER_NAME = "Les créations de Yona · sauvegardes";

	private static final String STATE_ATTRIBUTE = DriveBackupService.class.getName() + ".state";

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private static final LocalTime NIGHTLY_AT = LocalTime.of(3, 0);

	private static final SecureRandom RANDOM = new SecureRandom();

	private static final Logger log = LoggerFactory.getLogger(DriveBackupService.class);

	private final DriveLinkStore store;

	private final GoogleDrive drive;

	private final BackupService backupService;

	private final AuditorAware<String> auditor;

	private final AtomicBoolean running = new AtomicBoolean();

	private final ExecutorService worker = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("drive-backup").factory());

	DriveBackupService(DriveLinkStore store, GoogleDrive drive, BackupService backupService, AuditorAware<String> auditor) {
		this.store = store;
		this.drive = drive;
		this.backupService = backupService;
		this.auditor = auditor;
	}

	public DriveStatus status() {
		return store.find()
			.map(link -> new DriveStatus(true, link.accountEmail(),
					link.folderId() == null ? null : "https://drive.google.com/drive/folders/" + link.folderId(),
					link.connectedAt(), running.get(), link.lastBackupAt(), link.lastBackupOk(), link.lastBackupError(),
					link.lastBackupFile(), link.lastBackupBytes(), nextNightlyBackup(), KEPT_BACKUPS))
			.orElseGet(() -> new DriveStatus(false, null, null, null, false, null, null, null, null, null, null,
					KEPT_BACKUPS));
	}

	/** Google's consent page; the state, kept in the admin's session, ties the answer to this request. */
	public String authorizationUrl(HttpSession session, String redirectUri) {
		String state = HexFormat.of().formatHex(randomBytes());
		session.setAttribute(STATE_ATTRIBUTE, state);
		return drive.authorizationUrl(redirectUri, state, auditor.getCurrentAuditor().orElse(""));
	}

	/** Google's answer: the account is kept, with a new folder for its backups. */
	public void connect(HttpSession session, String state, String code, String redirectUri)
			throws GoogleDrive.DriveException {
		Object expected = session.getAttribute(STATE_ATTRIBUTE);
		session.removeAttribute(STATE_ATTRIBUTE);
		if (!state.equals(expected)) {
			throw new GoogleDrive.DriveException("La connexion à Google Drive a expiré : recommencez.");
		}
		GoogleDrive.Tokens tokens = drive.exchange(code, redirectUri);
		String folderId = drive.createFolder(tokens.accessToken(), FOLDER_NAME);
		store.find().ifPresent(previous -> drive.revoke(previous.refreshToken()));
		store.connect(tokens.email(), tokens.refreshToken(), folderId, auditor.getCurrentAuditor().orElse(""));
		log.info("Google Drive backups connected to {}", tokens.email());
	}

	/** The backups already on the Drive stay there. */
	public void disconnect() {
		store.find().ifPresent(link -> drive.revoke(link.refreshToken()));
		store.disconnect();
	}

	/** "Sauvegarder maintenant", in the background: the back-office follows it with {@link #status()}. */
	public void startNow() {
		if (store.find().isEmpty()) {
			throw new ApiException(ErrorCode.DRIVE_NOT_CONNECTED);
		}
		if (!running.compareAndSet(false, true)) {
			throw new ApiException(ErrorCode.DRIVE_BACKUP_RUNNING);
		}
		worker.execute(this::backUpAndRelease);
	}

	@Scheduled(cron = "0 0 3 * * *", zone = "Europe/Paris")
	void backUpEveryNight() {
		if (store.find().isPresent() && running.compareAndSet(false, true)) {
			backUpAndRelease();
		}
	}

	@PreDestroy
	void stop() {
		worker.shutdownNow();
	}

	private void backUpAndRelease() {
		try {
			backUp();
		}
		finally {
			running.set(false);
		}
	}

	/** Written to a temporary file first: Google needs the size, and a failed upload resumes from it. */
	private void backUp() {
		DriveLinkStore.DriveLink link = store.find().orElse(null);
		if (link == null) {
			return;
		}
		Path file = null;
		try {
			String accessToken = drive.accessToken(link.refreshToken());
			String folderId = link.folderId();
			if (folderId == null || !drive.folderUsable(accessToken, folderId)) {
				folderId = drive.createFolder(accessToken, FOLDER_NAME);
				store.updateFolder(folderId);
			}
			file = Files.createTempFile("yona-drive-", ".zip");
			try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(file))) {
				backupService.writeTo(output);
			}
			String name = BackupService.fileName(Instant.now());
			long size = Files.size(file);
			drive.upload(accessToken, folderId, file, name);
			store.recordSuccess(name, size);
			log.info("Backup {} ({} bytes) sent to Google Drive", name, size);
			deleteOldBackups(accessToken, folderId);
		}
		catch (GoogleDrive.DriveException ex) {
			log.warn("Google Drive backup failed: {}", ex.getMessage(), ex);
			store.recordFailure(ex.getMessage());
		}
		catch (ApiException ex) {
			log.warn("Google Drive backup failed", ex);
			store.recordFailure(ex.getMessage());
		}
		catch (IOException | RuntimeException ex) {
			log.error("Google Drive backup failed", ex);
			store.recordFailure("La sauvegarde n'a pas pu être préparée sur le serveur (espace disque, base de données…).");
		}
		finally {
			if (file != null) {
				try {
					Files.deleteIfExists(file);
				}
				catch (IOException ex) {
					log.warn("Temporary backup {} could not be deleted", file, ex);
				}
			}
		}
	}

	/** A failure here leaves one backup too many, removed the next night: the backup itself is done. */
	private void deleteOldBackups(String accessToken, String folderId) {
		try {
			List<GoogleDrive.DriveFile> backups = drive.backups(accessToken, folderId);
			for (GoogleDrive.DriveFile old : backups.subList(Math.min(KEPT_BACKUPS, backups.size()), backups.size())) {
				drive.delete(accessToken, old.id());
				log.info("Old backup {} deleted from Google Drive", old.name());
			}
		}
		catch (GoogleDrive.DriveException ex) {
			log.warn("Old Google Drive backups could not be deleted: {}", ex.getMessage(), ex);
		}
	}

	private static @Nullable Instant nextNightlyBackup() {
		ZonedDateTime now = ZonedDateTime.now(PARIS);
		ZonedDateTime today = now.with(NIGHTLY_AT);
		return (today.isAfter(now) ? today : today.plusDays(1)).toInstant();
	}

	private static byte[] randomBytes() {
		byte[] bytes = new byte[24];
		RANDOM.nextBytes(bytes);
		return bytes;
	}

}
