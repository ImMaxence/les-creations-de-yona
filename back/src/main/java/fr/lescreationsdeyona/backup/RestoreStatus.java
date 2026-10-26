package fr.lescreationsdeyona.backup;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Where a restore stands, polled by the back-office while the server works. */
public record RestoreStatus(String id, State state,
		@Schema(description = "Bytes of the archive, as announced") long size,
		@Schema(description = "Bytes received so far") long received,
		@Schema(description = "Next chunk expected while uploading, from 0") int nextChunk,
		@Schema(description = "Why it failed (FAILED)") @Nullable String error,
		@Schema(description = "Once analysed (READY and after)") @Nullable Analysis analysis,
		@Schema(description = "Once applied (DONE)") @Nullable Report report) {

	public enum State {
		UPLOADING, ANALYZING, READY, APPLYING, DONE, FAILED
	}

	public enum Mode {
		MERGE, REPLACE
	}

	/** Recipes, categories… of a database, by count. */
	public record Counts(long recipes, long categories, long tags, long ingredients, long images, long socialLinks,
			long appearancePresets) {
	}

	/**
	 * What the archive holds, compared with the site.
	 *
	 * @param missing in the archive and not on the site: what "Fusionner" would add
	 * @param imageFilesMissing files of the archive absent from the site's storage
	 * @param imageFilesExtra files of the site's storage absent from the archive: deleted by "Tout remplacer"
	 */
	public record Analysis(@Nullable Instant backupCreatedAt, @Nullable String backupVersion, Counts backup,
			Counts current, Missing missing, long imageFiles, long imageFilesMissing, long imageFilesExtra) {
	}

	/** Names are given for the first 50 of each kind. */
	public record Missing(long recipes, List<String> recipeTitles, long categories, List<String> categoryNames,
			long tags, List<String> tagNames, long ingredients, long images, long socialLinks,
			List<String> socialPlatforms, long appearancePresets, List<String> appearancePresetNames) {
	}

	/** @param added by "Fusionner"; the site's new counts after "Tout remplacer" */
	public record Report(Mode mode, Counts added, long filesUploaded, long filesDeleted,
			@Schema(description = "Things that could not be restored, in French") List<String> warnings) {
	}

}
