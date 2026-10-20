package fr.lescreationsdeyona.social;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Social links")
@RestController
@RequestMapping("/api/admin/social-links")
@RequiredArgsConstructor
class AdminSocialLinkController {

	private final SocialLinkService socialLinkService;

	@Operation(summary = "Replace all social links; their order is the display order")
	@PutMapping
	List<SocialLinkResponse> replaceSocialLinks(@Valid @RequestBody SocialLinksForm form) {
		return socialLinkService.replaceAll(form);
	}

}
