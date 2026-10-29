package fr.lescreationsdeyona.content;

import fr.lescreationsdeyona.image.ImageChoice;
import fr.lescreationsdeyona.image.ImageProcessor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Site content")
@RestController
@RequestMapping("/api/admin/site-content")
@RequiredArgsConstructor
class AdminSiteContentController {

	private final SiteContentService siteContentService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "Change the texts of the \"À propos\" section and of the footer")
	@PutMapping
	SiteContentResponse updateSiteContent(@Valid @RequestBody SiteContentForm form) {
		return siteContentService.update(form);
	}

	@Operation(summary = "Upload a new photo for the \"À propos\" section; the previous one stays in the gallery",
			description = "JPEG or PNG, 10 MB max, landscape or square: at least 800 × 450 px.")
	@PutMapping(path = "/about-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	SiteContentResponse replaceAboutImage(@RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		return siteContentService.replaceAboutImage(imageProcessor.process(file));
	}

	@Operation(summary = "Show an image of the gallery in the \"À propos\" section, or none (the bundled photo)")
	@PutMapping("/about-image-choice")
	SiteContentResponse chooseAboutImage(@RequestBody ImageChoice choice) {
		return siteContentService.chooseAboutImage(choice.imageId());
	}

}
