package fr.lescreationsdeyona.content;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Site content")
@RestController
@RequestMapping("/api/site-content")
@RequiredArgsConstructor
class SiteContentController {

	private final SiteContentService siteContentService;

	@Operation(summary = "Texts and photo of the site: the \"À propos\" section of the home page, the footer")
	@GetMapping
	SiteContentResponse getSiteContent() {
		return siteContentService.get();
	}

}
