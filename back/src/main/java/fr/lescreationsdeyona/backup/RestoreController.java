package fr.lescreationsdeyona.backup;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Restore of a backup archive: start, send the chunks, poll the status until the analysis is
 * ready, then merge or replace. See {@link RestoreService}.
 */
@Tag(name = "Admin - Restore")
@RestController
@RequestMapping("/api/admin/restore")
@RequiredArgsConstructor
class RestoreController {

	private final RestoreService restoreService;

	record RestoreStart(@Schema(description = "Size of the archive, in bytes") @Positive long size) {
	}

	record RestoreApply(@NotNull RestoreStatus.Mode mode,
			@Schema(description = "REPLACE only: the word REMPLACER, typed by the admin") @Size(max = 20)
			@Nullable String confirmation) {
	}

	@Operation(summary = "Start a restore: the archive is then sent in chunks of 32 MiB",
			description = "Replaces an abandoned or finished restore; refused while one is analysed or applied.")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	RestoreStatus startRestore(@Valid @RequestBody RestoreStart start) {
		return restoreService.start(start.size());
	}

	@Operation(summary = "Send a chunk of the archive, in order from 0; the last one starts the analysis",
			requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
					mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE, schema = @Schema(type = "string", format = "binary"))))
	@PutMapping(path = "/{id}/chunks/{index}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
	RestoreStatus uploadRestoreChunk(@PathVariable String id, @PathVariable @PositiveOrZero int index,
			HttpServletRequest request) throws IOException {
		// Read as a stream: the chunk is written to the archive file, never held in memory.
		return restoreService.appendChunk(id, index, request.getInputStream());
	}

	@Operation(summary = "Where the restore stands: upload, analysis (then what the archive holds), application")
	@GetMapping("/{id}")
	RestoreStatus getRestore(@PathVariable String id) {
		return restoreService.status(id);
	}

	@Operation(summary = "Merge (add only what the site lacks) or replace everything with the archive",
			description = "Runs in the background: poll GET /api/admin/restore/{id} until DONE or FAILED.")
	@PostMapping("/{id}/apply")
	RestoreStatus applyRestore(@PathVariable String id, @Valid @RequestBody RestoreApply apply) {
		return restoreService.apply(id, apply.mode(), apply.confirmation());
	}

	@Operation(summary = "Cancel a restore, or forget a finished one; the archive is deleted from the server")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void cancelRestore(@PathVariable String id) {
		restoreService.cancel(id);
	}

}
