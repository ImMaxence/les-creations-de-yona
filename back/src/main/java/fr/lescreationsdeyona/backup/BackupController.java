package fr.lescreationsdeyona.backup;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Tag(name = "Admin - Backup")
@RestController
@RequestMapping("/api/admin/backup")
@RequiredArgsConstructor
class BackupController {

	private static final String ZIP = "application/zip";

	private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmm");

	private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

	private final BackupService backupService;

	@Operation(summary = "Download a ZIP of the database and of every image",
			description = "database.dump (pg_dump, custom format) and images/ (the whole S3 bucket). "
					+ "Streamed: open it as a plain link rather than through HttpClient, which would buffer it.",
			responses = @ApiResponse(responseCode = "200",
					content = @Content(mediaType = ZIP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping
	ResponseEntity<StreamingResponseBody> downloadBackup() {
		StreamingResponseBody archive = backupService.start();
		String fileName = "les-creations-de-yona-" + FILE_DATE.format(ZonedDateTime.now(PARIS)) + ".zip";
		return ResponseEntity.ok()
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
			.cacheControl(CacheControl.noStore())
			.contentType(MediaType.parseMediaType(ZIP))
			.body(archive);
	}

}
