package fr.lescreationsdeyona.security;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/admin")
class AuthController {

	@Operation(summary = "Logged-in admin; 401 when the session is missing or expired",
			description = "Logout: POST /api/auth/logout (204), with the X-XSRF-TOKEN header.")
	@GetMapping("/me")
	AdminResponse getCurrentAdmin(@Parameter(hidden = true) @AuthenticationPrincipal OidcUser admin,
			@Parameter(hidden = true) CsrfToken csrfToken) {
		// The CSRF token is lazy: reading it makes Spring Security write the XSRF-TOKEN cookie for the
		// back-office only, so public visitors never get it.
		csrfToken.getToken();
		return new AdminResponse(admin.getEmail(), admin.getFullName());
	}

}
