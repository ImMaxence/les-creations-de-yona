package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.security.AccountResponses.AccountNameForm;
import fr.lescreationsdeyona.security.AccountResponses.MyAccount;
import fr.lescreationsdeyona.security.AccountResponses.PasskeyLabelForm;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * "Mon compte": the name and the photo of the admin signed in, and their ways in. Linking Google or
 * Microsoft is a full page navigation: {@code /api/oauth2/authorization/google?link=1}.
 */
@Tag(name = "Admin - Account")
@RestController
@RequestMapping("/api/admin/account")
class AdminAccountController {

	private final AccountManagement management;

	private final AdminAccounts accounts;

	private final Passkeys passkeys;

	private final ImageProcessor imageProcessor;

	AdminAccountController(AccountManagement management, AdminAccounts accounts, Passkeys passkeys, ImageProcessor imageProcessor) {
		this.management = management;
		this.accounts = accounts;
		this.passkeys = passkeys;
		this.imageProcessor = imageProcessor;
	}

	@Operation(summary = "The account of the admin signed in: name, photo, Google and Microsoft accounts linked, passkeys")
	@GetMapping
	MyAccount getMyAccount(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me) {
		return management.mine(me);
	}

	@Operation(summary = "Change their name, as the others see it")
	@PutMapping("/name")
	MyAccount renameMyAccount(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @Valid @RequestBody AccountNameForm form) {
		return management.rename(me, form.name());
	}

	@Operation(summary = "A photo of their own (JPEG or PNG), cut to a square in its middle")
	@PutMapping(path = "/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	MyAccount setMyPhoto(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @RequestPart("file") MultipartFile file) {
		return management.setPhoto(me, imageProcessor.processAvatar(file));
	}

	@Operation(summary = "Back to the photo of their Google account, or their initial")
	@DeleteMapping("/photo")
	MyAccount removeMyPhoto(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me) {
		return management.removePhoto(me);
	}

	@Operation(summary = "Unlink their Google or Microsoft account; refused for their last way in")
	@DeleteMapping("/identities/{provider}")
	MyAccount unlinkMyIdentity(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable IdentityProvider provider) {
		return management.unlink(me, provider);
	}

	@Hidden
	@PostMapping(path = "/passkeys/options", produces = MediaType.APPLICATION_JSON_VALUE)
	String myPasskeyOptions(@AuthenticationPrincipal AdminPrincipal me, HttpServletRequest request) {
		return passkeys.creationOptions(account(me), request.getSession(true));
	}

	@Hidden
	@PostMapping(path = "/passkeys", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	MyAccount addMyPasskey(@AuthenticationPrincipal AdminPrincipal me, @RequestBody String credential, HttpServletRequest request) {
		passkeys.register(account(me), credential, request.getSession(true));
		return management.mine(me);
	}

	@Operation(summary = "Rename one of their passkeys (\"iPhone de Yona\")")
	@PutMapping("/passkeys/{id}")
	MyAccount renameMyPasskey(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable String id,
			@Valid @RequestBody PasskeyLabelForm form) {
		return management.renamePasskey(me, id, form.label());
	}

	@Operation(summary = "Delete one of their passkeys; refused for their last way in",
			description = "The passkey stays on the device until removed there too (Réglages, gestionnaire de mots de passe).")
	@DeleteMapping("/passkeys/{id}")
	MyAccount deleteMyPasskey(@Parameter(hidden = true) @AuthenticationPrincipal AdminPrincipal me, @PathVariable String id) {
		return management.deletePasskey(me, id);
	}

	private Account account(AdminPrincipal me) {
		return accounts.find(me.id()).orElseThrow(() -> new ApiException(ErrorCode.ACCOUNT_NOT_FOUND));
	}

}
