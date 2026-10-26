package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.jspecify.annotations.Nullable;

/**
 * The archive of "Sauvegarder mes données", read back by the restore. Only the expected entries
 * are accepted: images are kept under S3 keys of the known shape, so that no file name from the
 * archive can reach anything else. An archive unzipped then zipped again (macOS does so on
 * download) has its files in a folder: that folder is accepted, and the files macOS adds ignored.
 */
final class BackupArchive implements AutoCloseable {

	static final String MANIFEST_ENTRY = "manifest.json";

	static final String DATABASE_ENTRY = "database.dump";

	static final String IMAGES_FOLDER = "images/";

	private static final Pattern IMAGE_KEY = Pattern
		.compile("(recipes|categories|gallery|site|pinterest)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/(800|1600)\\.webp");

	private static final Pattern MANIFEST_FIELD = Pattern.compile("\"(createdAt|version)\"\\s*:\\s*\"([^\"]{1,40})\"");

	private static final int MAX_ENTRIES = 200_000;

	private static final long MAX_DUMP_BYTES = 2L * 1024 * 1024 * 1024;

	private static final long MAX_IMAGE_BYTES = 20L * 1024 * 1024;

	private static final long MAX_MANIFEST_BYTES = 4096;

	private static final byte[] RIFF = "RIFF".getBytes(StandardCharsets.US_ASCII);

	private static final byte[] WEBP = "WEBP".getBytes(StandardCharsets.US_ASCII);

	private final ZipFile zip;

	private final ZipEntry dump;

	private final @Nullable ZipEntry manifest;

	/** By S3 key. */
	private final Map<String, ZipEntry> images;

	private BackupArchive(ZipFile zip, ZipEntry dump, @Nullable ZipEntry manifest, Map<String, ZipEntry> images) {
		this.zip = zip;
		this.dump = dump;
		this.manifest = manifest;
		this.images = images;
	}

	/** {@code {"format":1,"createdAt":"2026-10-26T09:00:00Z","version":"2.1.0"}} */
	static String manifest(Instant createdAt, String version) {
		return "{\"format\":1,\"createdAt\":\"" + createdAt + "\",\"version\":\"" + version.replace("\"", "") + "\"}";
	}

	static BackupArchive open(Path file) {
		ZipFile zip;
		try {
			zip = new ZipFile(file.toFile(), StandardCharsets.UTF_8);
		}
		catch (IOException ex) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID, ex);
		}
		try {
			return read(zip);
		}
		catch (RuntimeException ex) {
			closeQuietly(zip);
			throw ex;
		}
	}

	private static BackupArchive read(ZipFile zip) {
		if (zip.size() > MAX_ENTRIES) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
		String prefix = folderOf(zip);
		ZipEntry dump = null;
		ZipEntry manifest = null;
		Map<String, ZipEntry> images = new LinkedHashMap<>();
		for (ZipEntry entry : Collections.list(zip.entries())) {
			String name = entry.getName();
			if (entry.isDirectory() || isSystemFile(name)) {
				continue;
			}
			if (!name.startsWith(prefix)) {
				throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
			}
			String path = name.substring(prefix.length());
			if (path.equals(DATABASE_ENTRY) && entry.getSize() <= MAX_DUMP_BYTES) {
				dump = entry;
			}
			else if (path.equals(MANIFEST_ENTRY) && entry.getSize() <= MAX_MANIFEST_BYTES) {
				manifest = entry;
			}
			else if (path.startsWith(IMAGES_FOLDER) && IMAGE_KEY.matcher(path.substring(IMAGES_FOLDER.length())).matches()
					&& entry.getSize() <= MAX_IMAGE_BYTES) {
				images.put(path.substring(IMAGES_FOLDER.length()), entry);
			}
			else {
				throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
			}
		}
		if (dump == null) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
		return new BackupArchive(zip, dump, manifest, images);
	}

	/** "" when the files are at the root; "folder/" when the whole archive sits in one folder. */
	private static String folderOf(ZipFile zip) {
		String folder = null;
		for (Enumeration<? extends ZipEntry> entries = zip.entries(); entries.hasMoreElements();) {
			String name = entries.nextElement().getName();
			if (isSystemFile(name)) {
				continue;
			}
			if (name.equals(DATABASE_ENTRY)) {
				return "";
			}
			if (name.endsWith("/" + DATABASE_ENTRY) && name.indexOf('/') == name.length() - DATABASE_ENTRY.length() - 1) {
				folder = name.substring(0, name.length() - DATABASE_ENTRY.length());
			}
		}
		if (folder == null) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
		return folder;
	}

	private static boolean isSystemFile(String name) {
		return name.startsWith("__MACOSX/") || name.endsWith(".DS_Store") || name.endsWith("Thumbs.db");
	}

	Map<String, ZipEntry> images() {
		return images;
	}

	/** Date of the backup: from its manifest, or the date of its database file for older ones. */
	@Nullable Instant createdAt() {
		String value = manifestField("createdAt");
		if (value != null) {
			try {
				return Instant.parse(value);
			}
			catch (DateTimeParseException ex) {
				// Falls back on the entry date
			}
		}
		return dump.getLastModifiedTime() == null ? null : dump.getLastModifiedTime().toInstant();
	}

	/** Version of the site that made it; absent before backups had a manifest (2.1.0). */
	@Nullable String version() {
		return manifestField("version");
	}

	/** The database dump, copied to a file for pg_restore; never more than it declares. */
	void extractDump(Path target) throws IOException {
		try (InputStream input = zip.getInputStream(dump); OutputStream output = Files.newOutputStream(target)) {
			copyAtMost(input, output, Math.min(dump.getSize() < 0 ? MAX_DUMP_BYTES : dump.getSize(), MAX_DUMP_BYTES));
		}
	}

	/** An image file, checked to be WebP: the bucket only ever holds the site's own WebP files. */
	byte[] readImage(String key) throws IOException {
		ZipEntry entry = images.get(key);
		byte[] content;
		try (InputStream input = zip.getInputStream(entry)) {
			content = input.readNBytes((int) MAX_IMAGE_BYTES + 1);
		}
		if (content.length > MAX_IMAGE_BYTES || content.length < 12
				|| !Arrays.equals(content, 0, 4, RIFF, 0, 4)
				|| !Arrays.equals(content, 8, 12, WEBP, 0, 4)) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
		return content;
	}

	private @Nullable String manifestField(String field) {
		if (manifest == null) {
			return null;
		}
		try (InputStream input = zip.getInputStream(manifest)) {
			String json = new String(input.readNBytes((int) MAX_MANIFEST_BYTES), StandardCharsets.UTF_8);
			Matcher matcher = MANIFEST_FIELD.matcher(json);
			while (matcher.find()) {
				if (matcher.group(1).equals(field)) {
					return matcher.group(2);
				}
			}
			return null;
		}
		catch (IOException ex) {
			return null;
		}
	}

	/** Stops a zip entry inflating past its declared size (zip bomb). */
	private static void copyAtMost(InputStream input, OutputStream output, long limit) throws IOException {
		byte[] buffer = new byte[64 * 1024];
		long copied = 0;
		int read;
		while ((read = input.read(buffer)) != -1) {
			copied += read;
			if (copied > limit) {
				throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
			}
			output.write(buffer, 0, read);
		}
	}

	private static void closeQuietly(ZipFile zip) {
		try {
			zip.close();
		}
		catch (IOException ex) {
			// Nothing more to do
		}
	}

	@Override
	public void close() {
		closeQuietly(zip);
	}

}
