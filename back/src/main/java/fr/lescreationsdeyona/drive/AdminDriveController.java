package fr.lescreationsdeyona.drive;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Connecting an account is done by the browser itself, as plain links: {@code connect} sends it to
 * Google, which sends it back to {@code callback}, which lands on the backup page of the
 * back-office ({@code ?drive=connecte}, or {@code ?drive=erreur&message=…}).
 */
@Tag(name = "Admin - Google Drive")
@RestController
@RequestMapping("/api/admin/drive")
@RequiredArgsConstructor
class AdminDriveController {

	private static final String BACK_OFFICE_PAGE = "/admin/sauvegarde";

	private static final Logger log = LoggerFactory.getLogger(AdminDriveController.class);

	private final DriveBackupService driveBackupService;

	@Operation(summary = "Google Drive backups: account, last and next backup")
	@GetMapping
	DriveStatus getDriveStatus() {
		return driveBackupService.status();
	}

	@Hidden
	@GetMapping("/connect")
	ResponseEntity<Void> connectDrive(HttpSession session) {
		return redirect(driveBackupService.authorizationUrl(session, callbackUrl()));
	}

	@Hidden
	@GetMapping("/callback")
	ResponseEntity<Void> driveCallback(HttpSession session, @RequestParam(required = false) @Nullable String code,
			@RequestParam(required = false) @Nullable String state, @RequestParam(required = false) @Nullable String error) {
		if (code == null || state == null) {
			// "access_denied": the admin cancelled on Google's page
			return backOffice("refuse", null);
		}
		try {
			driveBackupService.connect(session, state, code, callbackUrl());
			return backOffice("connecte", null);
		}
		catch (GoogleDrive.DriveException ex) {
			log.warn("Google Drive connection failed: {}", ex.getMessage(), ex);
			return backOffice("erreur", ex.getMessage());
		}
	}

	@Operation(summary = "Back up to Google Drive now, in the background", description = "Follow it with GET.")
	@PostMapping("/backup")
	@ResponseStatus(HttpStatus.ACCEPTED)
	DriveStatus backUpToDriveNow() {
		driveBackupService.startNow();
		return driveBackupService.status();
	}

	@Operation(summary = "Disconnect the Google Drive account; its backups stay on the Drive")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void disconnectDrive() {
		driveBackupService.disconnect();
	}

	/** On the public origin (X-Forwarded-* headers): the address registered with Google. */
	private static String callbackUrl() {
		return ServletUriComponentsBuilder.fromCurrentContextPath().path("/api/admin/drive/callback").toUriString();
	}

	private static ResponseEntity<Void> backOffice(String outcome, @Nullable String message) {
		UriComponentsBuilder page = UriComponentsBuilder.fromPath(BACK_OFFICE_PAGE).queryParam("drive", outcome);
		if (message != null) {
			page.queryParam("message", message);
		}
		return redirect(page.encode().build().toUriString());
	}

	private static ResponseEntity<Void> redirect(String location) {
		return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
	}

}
