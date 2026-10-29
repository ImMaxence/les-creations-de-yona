package fr.lescreationsdeyona.content;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
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

	private final AuditLog auditLog;

	public SiteContentResponse get() {
		return toResponse(find());
	}

	@Transactional
	public SiteContentResponse update(SiteContentForm form) {
		SiteContent content = find();
		AuditChanges changes = new AuditChanges().add("Titre « À propos »", content.getAboutTitle(), form.aboutTitle())
			.add("Texte « À propos »", content.getAboutText(), form.aboutText())
			.add("Pied de page", content.getFooterText(), form.footerText())
			.add("Accueil, sur-titre des recettes", content.getLatestEyebrow(), form.latestEyebrow())
			.add("Accueil, titre des recettes", content.getLatestTitle(), form.latestTitle())
			.add("Accueil, sur-titre des menus", content.getMenusEyebrow(), form.menusEyebrow())
			.add("Accueil, titre des menus", content.getMenusTitle(), form.menusTitle())
			.add("Accueil, sur-titre des catégories", content.getCategoriesEyebrow(), form.categoriesEyebrow())
			.add("Accueil, titre des catégories", content.getCategoriesTitle(), form.categoriesTitle());
		content.setAboutTitle(form.aboutTitle().strip());
		content.setAboutText(form.aboutText().strip());
		content.setFooterText(form.footerText().strip());
		content.setLatestEyebrow(form.latestEyebrow().strip());
		content.setLatestTitle(form.latestTitle().strip());
		content.setMenusEyebrow(form.menusEyebrow().strip());
		content.setMenusTitle(form.menusTitle().strip());
		content.setCategoriesEyebrow(form.categoriesEyebrow().strip());
		content.setCategoriesTitle(form.categoriesTitle().strip());
		auditLog.record(AuditAction.UPDATED, AuditKind.SITE_CONTENT, "Textes du site", null, changes);
		return toResponse(siteContentRepository.saveAndFlush(content));
	}

	/** A new photo for "À propos"; the previous one stays in the gallery. */
	@Transactional
	public SiteContentResponse replaceAboutImage(ProcessedImage processed) {
		SiteContent content = find();
		content.setAboutImage(imageService.create(ImageKind.SITE, processed));
		auditLog.record(AuditAction.UPDATED, AuditKind.SITE_CONTENT, "Photo « À propos »", null);
		return toResponse(siteContentRepository.saveAndFlush(content));
	}

	/** A photo of the gallery, or none: back to the photo bundled with the front. */
	@Transactional
	public SiteContentResponse chooseAboutImage(@Nullable UUID imageId) {
		SiteContent content = find();
		content.setAboutImage(imageId == null ? null : imageService.getLandscape(imageId));
		auditLog.record(AuditAction.UPDATED, AuditKind.SITE_CONTENT, "Photo « À propos »", null);
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
				image == null ? null : image.getId(), content.getFooterText(), content.getLatestEyebrow(),
				content.getLatestTitle(), content.getMenusEyebrow(), content.getMenusTitle(), content.getCategoriesEyebrow(),
				content.getCategoriesTitle());
	}

}
