package fr.lescreationsdeyona.social;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Social links")
@RestController
@RequestMapping("/api/social-links")
@RequiredArgsConstructor
class SocialLinkController {

	private final SocialLinkService socialLinkService;

	@Operation(summary = "Social links, in display order")
	@GetMapping
	List<SocialLinkResponse> listSocialLinks() {
		return socialLinkService.list();
	}

}
