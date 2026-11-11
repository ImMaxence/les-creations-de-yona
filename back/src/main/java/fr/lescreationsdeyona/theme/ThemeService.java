package fr.lescreationsdeyona.theme;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ThemeService {

	private final SiteThemeRepository siteThemeRepository;

	private final AuditLog auditLog;

	private final JsonMapper jsonMapper;

	@Cacheable(PublicCache.THEME)
	public ThemeResponse get() {
		return toResponse(find());
	}

	@Transactional
	public ThemeResponse update(ThemeForm form) {
		if (form.preset() == ThemePreset.PERSONNALISE && form.customColors() == null) {
			throw new ApiException(ErrorCode.THEME_CUSTOM_COLORS_REQUIRED);
		}
		SiteTheme theme = find();
		String customColors = form.customColors() == null ? theme.getCustomColors() : jsonMapper.writeValueAsString(form.customColors());
		AuditChanges changes = new AuditChanges()
			.add("Couleurs", AuditChanges.named(theme.getPreset()), AuditChanges.named(form.preset()))
			.add("Police des titres", AuditChanges.named(theme.getDisplayFont()), AuditChanges.named(form.displayFont()))
			.add("Police du texte", AuditChanges.named(theme.getBodyFont()), AuditChanges.named(form.bodyFont()))
			.add("Arrondi", theme.getRadiusPx() + " px", form.radiusPx() + " px")
			.add("Couleurs personnalisées", described(theme.getCustomColors()), described(customColors));
		theme.setPreset(form.preset());
		theme.setDisplayFont(form.displayFont());
		theme.setBodyFont(form.bodyFont());
		theme.setRadiusPx(form.radiusPx());
		theme.setCustomColors(customColors);
		auditLog.record(AuditAction.UPDATED, AuditKind.APPEARANCE, "Apparence du site", null, changes);
		return toResponse(siteThemeRepository.saveAndFlush(theme));
	}

	/** The row is created by the migration: its absence is a broken database, not a client error. */
	private SiteTheme find() {
		return siteThemeRepository.findById(SiteTheme.SINGLE_ROW_ID)
			.orElseThrow(() -> new IllegalStateException("site_theme row missing"));
	}

	private ThemeResponse toResponse(SiteTheme theme) {
		return new ThemeResponse(theme.getPreset(), theme.getDisplayFont(), theme.getBodyFont(), theme.getRadiusPx(),
				customColors(jsonMapper, theme.getCustomColors()));
	}

	/** As kept: null when none were chosen, or when they cannot be read any more. */
	static @Nullable CustomColors customColors(JsonMapper jsonMapper, @Nullable String json) {
		if (json == null) {
			return null;
		}
		try {
			return jsonMapper.readValue(json, CustomColors.class);
		} catch (JacksonException e) {
			return null;
		}
	}

	/** "Clair : #fcf9f5, #f4e7e6, #36221c, #8c533e · Sombre : …", for the history. */
	private @Nullable String described(@Nullable String json) {
		CustomColors colors = customColors(jsonMapper, json);
		return colors == null ? null : "Clair : " + palette(colors.light()) + " · Sombre : " + palette(colors.dark());
	}

	private static String palette(CustomColors.CustomPalette palette) {
		return String.join(", ", palette.bg(), palette.surface(), palette.text(), palette.accent());
	}

}