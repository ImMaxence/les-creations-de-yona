package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.security.AccountResponses.AccountStatusForm;
import fr.lescreationsdeyona.security.AccountResponses.AdminUser;
import fr.lescreationsdeyona.security.AccountResponses.InviteForm;
import fr.lescreationsdeyona.security.AccountResponses.InvitedAdmin;
import fr.lescreationsdeyona.security.AccountResponses.IssuedAccessLink;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** "Utilisateurs": the admins, inviting one, a link to come back in, disabling, deleting. */
@Tag(name = "Admin - Accounts")
@RestController
@RequestMapping("/api/admin/accounts")
class AdminAccountsController {

	private final AccountManagement management;

	private final AdminAccounts accounts;

	AdminAccountsController(AccountManagement management, AdminAccounts accounts) {
		this.management = management;
		this.accounts = accounts;
	}

	@Operation(summary = "Every admin: photo, status, last sign-in, ways in, link waiting")
	@GetMapping
	List<AdminUser> listAdminAccounts(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me) {
		return management.users(me);
	}

	@Operation(summary = "Invite an admin: their account, and the link (7 days) to give them",
			description = "409 ACCOUNT_EMAIL_TAKEN when an account has this address.")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	InvitedAdmin inviteAdmin(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @Valid @RequestBody InviteForm form) {
		return management.invite(form, me, ServletUriComponentsBuilder.fromCurrentContextPath());
	}

	@Operation(summary = "A new link for this admin, in place of the one before",
			description = "A new invitation (7 days) for an admin who never came in; otherwise a recovery link (1 day), to add a way in.")
	@PostMapping("/{id}/access-link")
	@ResponseStatus(HttpStatus.CREATED)
	IssuedAccessLink issueAccessLink(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable long id) {
		return management.issueLink(id, me, ServletUriComponentsBuilder.fromCurrentContextPath());
	}

	@Operation(summary = "Cancel the link of this admin")
	@DeleteMapping("/{id}/access-link")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void cancelAccessLink(@PathVariable long id) {
		management.cancelLink(id);
	}

	@Operation(summary = "Disable an admin (out at once, on every device) or enable them again; not oneself")
	@PutMapping("/{id}/status")
	AdminUser setAdminAccountStatus(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable long id,
			@Valid @RequestBody AccountStatusForm form) {
		return management.setStatus(id, form.status(), me);
	}

	@Operation(summary = "Delete an admin's account; what they wrote stays. Not oneself")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAdminAccount(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable long id) {
		management.delete(id, me);
	}

	@Operation(summary = "The photo an admin chose (256 × 256 WebP); its address changes with it",
			responses = @ApiResponse(responseCode = "200", content = @Content(mediaType = "image/webp", schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/{id}/photo")
	ResponseEntity<byte[]> getAdminPhoto(@PathVariable long id) {
		byte[] photo = accounts.photo(id).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
		// Its address has the version: kept by the admin's browser, never by a proxy
		return ResponseEntity.ok()
			.cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePrivate().immutable())
			.contentType(MediaType.parseMediaType("image/webp"))
			.body(photo);
	}

}
