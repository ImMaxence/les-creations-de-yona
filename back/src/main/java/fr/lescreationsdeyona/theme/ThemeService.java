package fr.lescreationsdeyona.theme;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ThemeService {

	private final SiteThemeRepository siteThemeRepository;

	private final AuditLog auditLog;

	public ThemeResponse get() {
		return toResponse(find());
	}

	@Transactional
	public ThemeResponse update(ThemeForm form) {
		SiteTheme theme = find();
		AuditChanges changes = new AuditChanges()
			.add("Couleurs", AuditChanges.named(theme.getPreset()), AuditChanges.named(form.preset()))
			.add("Police des titres", AuditChanges.named(theme.getDisplayFont()), AuditChanges.named(form.displayFont()))
			.add("Police du texte", AuditChanges.named(theme.getBodyFont()), AuditChanges.named(form.bodyFont()))
			.add("Arrondi", theme.getRadiusPx() + " px", form.radiusPx() + " px");
		theme.setPreset(form.preset());
		theme.setDisplayFont(form.displayFont());
		theme.setBodyFont(form.bodyFont());
		theme.setRadiusPx(form.radiusPx());
		auditLog.record(AuditAction.UPDATED, AuditKind.APPEARANCE, "Apparence du site", null, changes);
		return toResponse(siteThemeRepository.saveAndFlush(theme));
	}

	/** The row is created by the migration: its absence is a broken database, not a client error. */
	private SiteTheme find() {
		return siteThemeRepository.findById(SiteTheme.SINGLE_ROW_ID)
			.orElseThrow(() -> new IllegalStateException("site_theme row missing"));
	}

	private static ThemeResponse toResponse(SiteTheme theme) {
		return new ThemeResponse(theme.getPreset(), theme.getDisplayFont(), theme.getBodyFont(), theme.getRadiusPx());
	}

}