package fr.lescreationsdeyona.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.image.ImageKind;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupArchiveTest {

	private static final String IMAGE_ID = "0b7c4a52-4f1e-4d7a-9c3e-2a6f1d8e5b90";

	@TempDir
	Path folder;

	@Test
	void acceptsThePhotosOfEveryKind() throws IOException {
		List<String> keys = Arrays.stream(ImageKind.values())
			.flatMap(kind -> List.of(kind.folder() + "/" + IMAGE_ID + "/800.webp", kind.folder() + "/" + IMAGE_ID + "/1600.webp")
				.stream())
			.toList();
		Path file = archive(keys.stream().map(key -> BackupArchive.IMAGES_FOLDER + key).toList());

		try (BackupArchive archive = BackupArchive.open(file)) {
			assertThat(archive.images().keySet()).containsExactlyInAnyOrderElementsOf(keys);
		}
	}

	@Test
	void refusesAFileOutOfTheExpectedOnes() throws IOException {
		Path file = archive(List.of(BackupArchive.IMAGES_FOLDER + "elsewhere/" + IMAGE_ID + "/800.webp"));

		assertThatThrownBy(() -> BackupArchive.open(file)).isInstanceOf(ApiException.class);
	}

	/** An archive holding a database dump and the given entries, each with a few bytes. */
	private Path archive(List<String> entries) throws IOException {
		Path file = folder.resolve("backup.zip");
		try (OutputStream output = Files.newOutputStream(file); ZipOutputStream zip = new ZipOutputStream(output)) {
			for (String name : Stream.concat(Stream.of(BackupArchive.DATABASE_ENTRY), entries.stream()).toList()) {
				zip.putNextEntry(new ZipEntry(name));
				zip.write("content".getBytes(StandardCharsets.US_ASCII));
				zip.closeEntry();
			}
		}
		return file;
	}

}
