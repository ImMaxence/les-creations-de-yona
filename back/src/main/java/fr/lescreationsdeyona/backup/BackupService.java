package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageStorage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Builds the "Sauvegarder mes données" archive while it downloads, so nothing is written on the server:
 * <ul>
 * <li>{@code manifest.json}: date of the backup and version of the site;</li>
 * <li>{@code database.dump}: {@code pg_dump} in custom format, restored with {@code pg_restore};</li>
 * <li>{@code images/...}: every file of the bucket, orphans included, under its S3 key.</li>
 * </ul>
 * Once the download has started, an error can no longer be reported as JSON: the connection is
 * cut, the browser marks the download as failed, and the cause is logged.
 * <p>
 * The tables tied to this server only ({@link #SITE_ONLY_TABLES}) are saved empty: their rows hold
 * keys and tokens, and restoring a backup leaves them as they are.
 */
@Service
@RequiredArgsConstructor
public class BackupService {

	private static final Logger log = LoggerFactory.getLogger(BackupService.class);

	/**
	 * Notification subscriptions, the site's notification keys, the Google Drive link, the history of
	 * the back-office and the visitors' messages (their emails do not leave the server): what belongs
	 * to this server rather than to the site's content.
	 */
	public static final List<String> SITE_ONLY_TABLES = List.of("push_subscription", "web_push_key",
			"google_drive_link", "audit_event", "feedback");

	private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmm");

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private final BackupProperties properties;

	private final DataSourceProperties dataSource;

	private final ImageStorage imageStorage;

	private final ObjectProvider<BuildProperties> buildProperties;

	private final AuditLog auditLog;

	/** Starts {@code pg_dump} right away, so that a missing client is still reported as an error. */
	public StreamingResponseBody start() {
		Process pgDump = startPgDump();
		auditLog.record(AuditAction.EXPORTED, AuditKind.BACKUP, "Sauvegarde téléchargée", null);
		return output -> {
			try {
				writeArchive(pgDump, output);
			}
			finally {
				pgDump.destroy();
			}
		};
	}

	/** The whole archive into {@code output}, e.g. a file sent to Google Drive afterwards. */
	public void writeTo(OutputStream output) throws IOException {
		Process pgDump = startPgDump();
		try {
			writeArchive(pgDump, output);
		}
		finally {
			pgDump.destroy();
		}
	}

	/** "les-creations-de-yona-2026-10-26-0300.zip", Paris time. */
	public static String fileName(Instant date) {
		return "les-creations-de-yona-" + FILE_DATE.format(date.atZone(PARIS)) + ".zip";
	}

	private Process startPgDump() {
		// A libpq URL is the JDBC one without its "jdbc:" prefix.
		String databaseUrl = dataSource.getUrl().replaceFirst("^jdbc:", "");
		List<String> command = new ArrayList<>(List.of(properties.pgDump(), "--format=custom", "--no-password",
				"--dbname=" + databaseUrl));
		SITE_ONLY_TABLES.forEach(table -> command.add("--exclude-table-data=public." + table));
		ProcessBuilder builder = new ProcessBuilder(command)
			// pg_dump error messages go to the backend logs.
			.redirectError(ProcessBuilder.Redirect.INHERIT);
		// Passed through the environment, which other users cannot read, unlike the command line.
		Map<String, String> environment = builder.environment();
		environment.put("PGUSER", dataSource.getUsername());
		environment.put("PGPASSWORD", dataSource.getPassword());
		try {
			return builder.start();
		}
		catch (IOException ex) {
			log.error("Cannot start {}: install the PostgreSQL 18 client or set PG_DUMP_PATH", properties.pgDump(), ex);
			throw new ApiException(ErrorCode.BACKUP_UNAVAILABLE, ex);
		}
	}

	private void writeArchive(Process pgDump, OutputStream output) throws IOException {
		try (ZipOutputStream zip = new ZipOutputStream(output)) {
			// The dump and the WebP files are already compressed: compressing them again would only cost CPU.
			zip.setLevel(Deflater.NO_COMPRESSION);

			addEntry(zip, BackupArchive.MANIFEST_ENTRY, new ByteArrayInputStream(
					BackupArchive.manifest(Instant.now(), version()).getBytes(StandardCharsets.UTF_8)));
			try (InputStream dump = pgDump.getInputStream()) {
				addEntry(zip, BackupArchive.DATABASE_ENTRY, dump);
			}
			requireSuccess(pgDump);

			Iterator<String> keys = imageStorage.listKeys("").iterator();
			while (keys.hasNext()) {
				String key = keys.next();
				try (InputStream content = imageStorage.open(key).content()) {
					addEntry(zip, BackupArchive.IMAGES_FOLDER + key, content);
				}
			}
		}
	}

	private String version() {
		BuildProperties build = buildProperties.getIfAvailable();
		return build != null ? build.getVersion() : "dev";
	}

	private static void addEntry(ZipOutputStream zip, String name, InputStream content) throws IOException {
		zip.putNextEntry(new ZipEntry(name));
		content.transferTo(zip);
		zip.closeEntry();
	}

	private static void requireSuccess(Process pgDump) throws IOException {
		try {
			int exitCode = pgDump.waitFor();
			if (exitCode != 0) {
				throw new IOException("pg_dump failed with exit code " + exitCode + ", see its message above");
			}
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new IOException("Interrupted while waiting for pg_dump", ex);
		}
	}

}
