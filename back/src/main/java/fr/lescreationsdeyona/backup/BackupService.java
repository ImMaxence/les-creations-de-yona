package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageStorage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Builds the "Sauvegarder mes données" archive while it downloads, so nothing is written on the server:
 * <ul>
 * <li>{@code database.dump}: {@code pg_dump} in custom format, restored with {@code pg_restore};</li>
 * <li>{@code images/...}: every file of the bucket, orphans included, under its S3 key.</li>
 * </ul>
 * Once the download has started, an error can no longer be reported as JSON: the connection is
 * cut, the browser marks the download as failed, and the cause is logged.
 */
@Service
@RequiredArgsConstructor
public class BackupService {

	private static final String DATABASE_ENTRY = "database.dump";

	private static final String IMAGES_FOLDER = "images/";

	private static final Logger log = LoggerFactory.getLogger(BackupService.class);

	private final BackupProperties properties;

	private final DataSourceProperties dataSource;

	private final ImageStorage imageStorage;

	/** Starts {@code pg_dump} right away, so that a missing client is still reported as an error. */
	public StreamingResponseBody start() {
		Process pgDump = startPgDump();
		return output -> {
			try {
				writeArchive(pgDump, output);
			}
			finally {
				pgDump.destroy();
			}
		};
	}

	private Process startPgDump() {
		// A libpq URL is the JDBC one without its "jdbc:" prefix.
		String databaseUrl = dataSource.getUrl().replaceFirst("^jdbc:", "");
		ProcessBuilder builder = new ProcessBuilder(List.of(properties.pgDump(), "--format=custom", "--no-password",
				"--dbname=" + databaseUrl))
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

			try (InputStream dump = pgDump.getInputStream()) {
				addEntry(zip, DATABASE_ENTRY, dump);
			}
			requireSuccess(pgDump);

			Iterator<String> keys = imageStorage.listKeys("").iterator();
			while (keys.hasNext()) {
				String key = keys.next();
				try (InputStream content = imageStorage.open(key).content()) {
					addEntry(zip, IMAGES_FOLDER + key, content);
				}
			}
		}
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
