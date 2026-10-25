package fr.lescreationsdeyona.content;

import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageKind;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ProcessedImage;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SiteContentService {

	private final SiteContentRepository siteContentRepository;

	private final ImageService imageService;

	public SiteContentResponse get() {
		return toResponse(find());
	}

	@Transactional
	public SiteContentResponse update(SiteContentForm form) {
		SiteContent content = find();
		content.setAboutTitle(form.aboutTitle().strip());
		content.setAboutText(form.aboutText().strip());
		content.setFooterText(form.footerText().strip());
		return toResponse(siteContentRepository.saveAndFlush(content));
	}

	/** A new photo for "À propos"; the previous one stays in the gallery. */
	@Transactional
	public SiteContentResponse replaceAboutImage(ProcessedImage processed) {
		SiteContent content = find();
		content.setAboutImage(imageService.create(ImageKind.SITE, processed));
		return toResponse(siteContentRepository.saveAndFlush(content));
	}

	/** A photo of the gallery, or none: back to the photo bundled with the front. */
	@Transactional
	public SiteContentResponse chooseAboutImage(@Nullable UUID imageId) {
		SiteContent content = find();
		content.setAboutImage(imageId == null ? null : imageService.get(imageId));
		return toResponse(siteContentRepository.saveAndFlush(content));
	}

	/** The row is created by the migration: its absence is a broken database, not a client error. */
	private SiteContent find() {
		return siteContentRepository.findById(SiteContent.SINGLE_ROW_ID)
			.orElseThrow(() -> new IllegalStateException("site_content row missing"));
	}

	private static SiteContentResponse toResponse(SiteContent content) {
		Image image = content.getAboutImage();
		return new SiteContentResponse(content.getAboutTitle(), content.getAboutText(),
				image == null ? null : image.getId(), content.getFooterText());
	}

}
