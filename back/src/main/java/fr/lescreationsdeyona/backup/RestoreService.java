package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageStorage;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * "Restaurer mes données": the archive of a backup is sent in chunks (Cloudflare refuses requests
 * over 100 MB), kept in a temporary folder, then analysed in the background: its database is
 * restored into a scratch database (see {@link ScratchDatabases}), brought to the site's schema
 * and compared with the site's. The admin then chooses to merge it (only what the site lacks is
 * added) or to replace everything. One restore at a time; the back-office polls its status.
 * <p>
 * Files are uploaded to storage before the database changes, so that no image record ever lacks
 * its files: at worst orphan files remain. "Tout remplacer" deletes the files absent from the
 * archive only once the database is replaced.
 */
@Service
public class RestoreService {

	static final int CHUNK_BYTES = 32 * 1024 * 1024;

	private static final long MAX_ARCHIVE_BYTES = 20L * 1024 * 1024 * 1024;

	/** Room for the archive and its extracted database, with a margin for the server. */
	private static final double SPACE_FACTOR = 2.2;

	private static final Duration EXPIRY = Duration.ofHours(1);

	private static final String REPLACE_CONFIRMATION = "REMPLACER";

	/** Temporary folders holding an archive, under java.io.tmpdir. */
	private static final String FOLDER_PREFIX = "yona-restore-";

	private static final Logger log = LoggerFactory.getLogger(RestoreService.class);

	private final ScratchDatabases scratchDatabases;

	private final RestoredData restoredData;

	private final ImageStorage imageStorage;

	private final JdbcClient siteJdbc;

	private final AuditLog auditLog;

	private final ExecutorService worker = Executors.newSingleThreadExecutor(Thread.ofPlatform()
		.name("restore")
		.daemon(true)
		.factory());

	private @Nullable Session session;

	RestoreService(ScratchDatabases scratchDatabases, RestoredData restoredData, ImageStorage imageStorage,
			JdbcClient siteJdbc, AuditLog auditLog) {
		this.scratchDatabases = scratchDatabases;
		this.restoredData = restoredData;
		this.imageStorage = imageStorage;
		this.siteJdbc = siteJdbc;
		this.auditLog = auditLog;
	}

	/** Mutable state of the restore in progress, guarded by the service's lock. */
	private static final class Session {

		final String id = UUID.randomUUID().toString();

		final Path folder;

		final Path archive;

		final long size;

		long received;

		int nextChunk;

		/** A chunk is being written: another one is refused meanwhile. */
		boolean writing;

		RestoreStatus.State state = RestoreStatus.State.UPLOADING;

		@Nullable String error;

		RestoreStatus.@Nullable Analysis analysis;

		RestoreStatus.@Nullable Report report;

		ScratchDatabases.@Nullable Scratch scratch;

		Instant touchedAt = Instant.now();

		Session(Path folder, long size) {
			this.folder = folder;
			this.archive = folder.resolve("backup.zip");
			this.size = size;
		}

		RestoreStatus status() {
			return new RestoreStatus(id, state, size, received, nextChunk, error, analysis, report);
		}

		boolean isWorking() {
			return state == RestoreStatus.State.ANALYZING || state == RestoreStatus.State.APPLYING;
		}

	}

	/** A new restore, replacing a finished or abandoned one; refused while one is being worked on. */
	public synchronized RestoreStatus start(long size) {
		if (size <= 0 || size > MAX_ARCHIVE_BYTES) {
			throw new ApiException(ErrorCode.RESTORE_TOO_LARGE);
		}
		if (session != null) {
			if (session.isWorking()) {
				throw new ApiException(ErrorCode.RESTORE_BUSY);
			}
			discard(session);
		}
		try {
			Path folder = Files.createTempDirectory(FOLDER_PREFIX);
			if (Files.getFileStore(folder).getUsableSpace() < size * SPACE_FACTOR) {
				Files.delete(folder);
				throw new ApiException(ErrorCode.RESTORE_NOT_ENOUGH_SPACE);
			}
			Files.createFile(folder.resolve("backup.zip"));
			session = new Session(folder, size);
			return session.status();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	/**
	 * Chunks come in order, each {@value #CHUNK_BYTES} bytes but the last. The analysis starts once
	 * the last one is in.
	 */
	public RestoreStatus appendChunk(String id, int index, InputStream content) {
		Session current = find(id);
		synchronized (this) {
			if (current.state != RestoreStatus.State.UPLOADING || index != current.nextChunk || current.writing) {
				throw new ApiException(ErrorCode.RESTORE_CHUNK_INVALID);
			}
			current.writing = true;
		}
		long expected = Math.min(CHUNK_BYTES, current.size - current.received);
		long written;
		try (OutputStream output = Files.newOutputStream(current.archive, StandardOpenOption.APPEND)) {
			written = copyAtMost(content, output, expected);
		}
		catch (IOException ex) {
			synchronized (this) {
				current.writing = false;
			}
			throw new UncheckedIOException(ex);
		}
		synchronized (this) {
			current.writing = false;
			if (written != expected) {
				// The file now holds a partial chunk: the whole upload has to start over.
				current.state = RestoreStatus.State.FAILED;
				current.error = ErrorCode.RESTORE_CHUNK_INVALID.message();
				throw new ApiException(ErrorCode.RESTORE_CHUNK_INVALID);
			}
			current.received += written;
			current.nextChunk++;
			current.touchedAt = Instant.now();
			if (current.received == current.size) {
				current.state = RestoreStatus.State.ANALYZING;
				worker.execute(() -> run(current, () -> analyze(current)));
			}
			return current.status();
		}
	}

	public synchronized RestoreStatus status(String id) {
		Session current = find(id);
		current.touchedAt = Instant.now();
		return current.status();
	}

	public synchronized RestoreStatus apply(String id, RestoreStatus.Mode mode, @Nullable String confirmation) {
		Session current = find(id);
		if (current.state != RestoreStatus.State.READY) {
			throw new ApiException(ErrorCode.RESTORE_NOT_READY);
		}
		if (mode == RestoreStatus.Mode.REPLACE && !REPLACE_CONFIRMATION.equals(confirmation)) {
			throw new ApiException(ErrorCode.RESTORE_CONFIRMATION_REQUIRED);
		}
		current.state = RestoreStatus.State.APPLYING;
		current.touchedAt = Instant.now();
		// Written now, by the admin's request: the restore itself runs in the background
		auditLog.record(AuditAction.IMPORTED, AuditKind.BACKUP, mode == RestoreStatus.Mode.MERGE
				? "Sauvegarde restaurée (ajouter ce qui manque)" : "Sauvegarde restaurée (tout remplacer)", null);
		worker.execute(() -> run(current, () -> {
			RestoreStatus.Report report = mode == RestoreStatus.Mode.MERGE ? merge(current) : replace(current);
			synchronized (this) {
				current.report = report;
				current.state = RestoreStatus.State.DONE;
			}
			log.info("Backup restored ({}): {}", mode, report);
		}));
		return current.status();
	}

	/** Cancels an upload, or forgets a finished restore; refused while the server works on it. */
	public synchronized void cancel(String id) {
		Session current = find(id);
		if (current.isWorking()) {
			throw new ApiException(ErrorCode.RESTORE_BUSY);
		}
		discard(current);
		session = null;
	}

	/** Abandoned restores, and scratch databases and folders left by a restart. */
	@Scheduled(initialDelay = 60_000, fixedDelay = 600_000)
	public synchronized void cleanUp() {
		if (session != null && !session.isWorking() && session.touchedAt.isBefore(Instant.now().minus(EXPIRY))) {
			discard(session);
			session = null;
		}
		ScratchDatabases.Scratch kept = session == null ? null : session.scratch;
		scratchDatabases.dropLeftovers(kept == null ? "" : kept.name());
		Path keptFolder = session == null ? null : session.folder;
		try (Stream<Path> folders = Files.list(Path.of(System.getProperty("java.io.tmpdir")))) {
			folders.filter(folder -> folder.getFileName().toString().startsWith(FOLDER_PREFIX) && !folder.equals(keptFolder))
				.forEach(RestoreService::deleteFolder);
		}
		catch (IOException ex) {
			log.warn("Leftover restore folders could not be listed", ex);
		}
	}

	@PreDestroy
	void stop() {
		worker.shutdownNow();
		if (session != null && session.scratch != null) {
			scratchDatabases.drop(session.scratch.name());
		}
	}

	private void analyze(Session current) throws IOException {
		Path dump = current.folder.resolve("database.dump");
		ScratchDatabases.Scratch scratch = scratchDatabases.create();
		synchronized (this) {
			current.scratch = scratch;
		}
		try (BackupArchive archive = BackupArchive.open(current.archive)) {
			archive.extractDump(dump);
			scratchDatabases.restore(scratch, dump);
			Files.deleteIfExists(dump);
			scratchDatabases.migrate(scratch);
			Map<String, Long> stored = imageStorage.sizes();
			Set<String> archived = archive.images().keySet();
			long missingFiles = archived.stream().filter(key -> !stored.containsKey(key)).count();
			long extraFiles = stored.keySet().stream().filter(key -> !archived.contains(key)).count();
			try (SingleConnectionDataSource source = scratch.open()) {
				JdbcClient scratchJdbc = JdbcClient.create(source);
				scratchDatabases.checkSchema(scratch, scratchJdbc);
				restoredData.checkValues(scratchJdbc);
				RestoreStatus.Analysis analysis = new RestoreStatus.Analysis(archive.createdAt(), archive.version(),
						restoredData.counts(scratchJdbc), restoredData.counts(siteJdbc), restoredData.missing(scratchJdbc),
						archived.size(), missingFiles, extraFiles);
				synchronized (this) {
					current.analysis = analysis;
					current.state = RestoreStatus.State.READY;
				}
			}
		}
	}

	private RestoreStatus.Report merge(Session current) throws IOException {
		List<String> warnings = new ArrayList<>();
		Set<String> stored = new HashSet<>(imageStorage.sizes().keySet());
		long uploaded;
		try (BackupArchive archive = BackupArchive.open(current.archive)) {
			uploaded = upload(archive, archive.images().keySet().stream().filter(key -> !stored.contains(key)).toList(),
					warnings);
		}
		stored.addAll(imageStorage.sizes().keySet());
		try (SingleConnectionDataSource source = scratch(current).open()) {
			RestoreStatus.Counts added = restoredData.merge(JdbcClient.create(source), stored);
			return new RestoreStatus.Report(RestoreStatus.Mode.MERGE, added, uploaded, 0, warnings);
		}
	}

	private RestoreStatus.Report replace(Session current) throws IOException {
		List<String> warnings = new ArrayList<>();
		Map<String, Long> stored = imageStorage.sizes();
		Set<String> archived;
		long uploaded;
		try (BackupArchive archive = BackupArchive.open(current.archive)) {
			archived = archive.images().keySet();
			List<String> toUpload = archive.images().entrySet().stream()
				.filter(entry -> !stored.containsKey(entry.getKey()) || stored.get(entry.getKey()) != entry.getValue().getSize())
				.map(Map.Entry::getKey)
				.toList();
			uploaded = upload(archive, toUpload, warnings);
		}
		RestoreStatus.Counts counts;
		try (SingleConnectionDataSource source = scratch(current).open()) {
			counts = restoredData.replace(source);
		}
		long deleted = 0;
		for (String key : stored.keySet()) {
			if (!archived.contains(key)) {
				try {
					imageStorage.delete(key);
					deleted++;
				}
				catch (RuntimeException ex) {
					log.warn("Could not delete {} after a restore", key, ex);
				}
			}
		}
		if (deleted < stored.keySet().stream().filter(key -> !archived.contains(key)).count()) {
			warnings.add("Certaines anciennes photos n'ont pas pu être supprimées du stockage : elles restent en fichiers orphelins, sans effet sur le site");
		}
		return new RestoreStatus.Report(RestoreStatus.Mode.REPLACE, counts, uploaded, deleted, warnings);
	}

	/** A file that fails is reported; its image record is then not restored by a merge. */
	private long upload(BackupArchive archive, List<String> keys, List<String> warnings) {
		long uploaded = 0;
		long failed = 0;
		for (String key : keys.stream().sorted(Comparator.naturalOrder()).toList()) {
			try {
				imageStorage.putWebp(key, archive.readImage(key));
				uploaded++;
			}
			catch (IOException | RuntimeException ex) {
				log.warn("Could not restore the file {}", key, ex);
				failed++;
			}
		}
		if (failed > 0) {
			warnings.add(failed + (failed > 1 ? " photos n'ont pas pu être restaurées" : " photo n'a pas pu être restaurée")
					+ " (fichier illisible dans l'archive, ou stockage indisponible)");
		}
		return uploaded;
	}

	/** Runs a step in the background; an error ends the restore with a message for the admin. */
	private void run(Session current, Step step) {
		try {
			step.run();
		}
		catch (ApiException ex) {
			fail(current, ex.getMessage(), ex);
		}
		catch (Exception ex) {
			fail(current, ErrorCode.INTERNAL_ERROR.message(), ex);
		}
	}

	@FunctionalInterface
	private interface Step {

		void run() throws Exception;

	}

	private synchronized void fail(Session current, String message, Exception ex) {
		log.warn("Restore failed: {}", message, ex);
		current.state = RestoreStatus.State.FAILED;
		current.error = message;
		if (current.scratch != null) {
			scratchDatabases.drop(current.scratch.name());
			current.scratch = null;
		}
	}

	private synchronized Session find(String id) {
		if (session == null || !session.id.equals(id)) {
			throw new ApiException(ErrorCode.RESTORE_NOT_FOUND);
		}
		return session;
	}

	private static ScratchDatabases.Scratch scratch(Session current) {
		ScratchDatabases.Scratch scratch = current.scratch;
		if (scratch == null) {
			throw new ApiException(ErrorCode.RESTORE_NOT_READY);
		}
		return scratch;
	}

	private void discard(Session old) {
		if (old.scratch != null) {
			scratchDatabases.drop(old.scratch.name());
			old.scratch = null;
		}
		deleteFolder(old.folder);
	}

	private static void deleteFolder(Path folder) {
		try (Stream<Path> files = Files.list(folder)) {
			for (Path file : files.toList()) {
				Files.deleteIfExists(file);
			}
			Files.deleteIfExists(folder);
		}
		catch (IOException ex) {
			log.warn("Restore folder {} could not be deleted", folder, ex);
		}
	}

	/** At most {@code limit} bytes; a longer body is cut, and the caller sees the count go past it. */
	private static long copyAtMost(InputStream input, OutputStream output, long limit) throws IOException {
		byte[] buffer = new byte[64 * 1024];
		long copied = 0;
		int read;
		while ((read = input.read(buffer)) != -1) {
			if (copied + read > limit) {
				output.write(buffer, 0, (int) (limit - copied));
				return limit + 1;
			}
			output.write(buffer, 0, read);
			copied += read;
		}
		return copied;
	}

}
