package fr.lescreationsdeyona.theme;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ThemeService {

	private final SiteThemeRepository siteThemeRepository;

	public ThemeResponse get() {
		return toResponse(find());
	}

	@Transactional
	public ThemeResponse update(ThemeForm form) {
		SiteTheme theme = find();
		theme.setPreset(form.preset());
		theme.setDisplayFont(form.displayFont());
		theme.setBodyFont(form.bodyFont());
		theme.setRadiusPx(form.radiusPx());
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