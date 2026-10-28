package fr.lescreationsdeyona.theme;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Looks saved under a name. Applying one only fills the Apparence form: saving it is a separate step. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppearancePresetService {

	private final AppearancePresetRepository repository;

	private final AuditLog auditLog;

	public List<AppearancePresetResponse> list() {
		return repository.findAll(Sort.by("name")).stream().map(AppearancePresetService::toResponse).toList();
	}

	@Transactional
	public AppearancePresetResponse create(AppearancePresetForm form) {
		String name = form.name().strip();
		if (repository.existsByName(name)) {
			throw new ApiException(ErrorCode.APPEARANCE_PRESET_NAME_TAKEN);
		}
		AppearancePreset preset = new AppearancePreset();
		apply(preset, name, form.theme());
		AppearancePreset saved = repository.saveAndFlush(preset);
		auditLog.record(AuditAction.CREATED, AuditKind.APPEARANCE, "Préréglage « " + name + " »", saved.getId());
		return toResponse(saved);
	}

	/** Renamed, or given the look being edited. */
	@Transactional
	public AppearancePresetResponse update(long id, AppearancePresetForm form) {
		AppearancePreset preset = repository.findById(id)
			.orElseThrow(() -> new ApiException(ErrorCode.APPEARANCE_PRESET_NOT_FOUND));
		String name = form.name().strip();
		if (repository.existsByNameAndIdNot(name, id)) {
			throw new ApiException(ErrorCode.APPEARANCE_PRESET_NAME_TAKEN);
		}
		apply(preset, name, form.theme());
		auditLog.record(AuditAction.UPDATED, AuditKind.APPEARANCE, "Préréglage « " + name + " »", id);
		return toResponse(repository.saveAndFlush(preset));
	}

	@Transactional
	public void delete(long id) {
		AppearancePreset preset = repository.findById(id)
			.orElseThrow(() -> new ApiException(ErrorCode.APPEARANCE_PRESET_NOT_FOUND));
		repository.delete(preset);
		auditLog.record(AuditAction.DELETED, AuditKind.APPEARANCE, "Préréglage « " + preset.getName() + " »", null);
	}

	private static void apply(AppearancePreset preset, String name, ThemeForm theme) {
		preset.setName(name);
		preset.setPreset(theme.preset());
		preset.setDisplayFont(theme.displayFont());
		preset.setBodyFont(theme.bodyFont());
		preset.setRadiusPx(theme.radiusPx());
	}

	private static AppearancePresetResponse toResponse(AppearancePreset preset) {
		return new AppearancePresetResponse(preset.getId(), preset.getName(), new ThemeResponse(preset.getPreset(),
				preset.getDisplayFont(), preset.getBodyFont(), preset.getRadiusPx()), preset.getUpdatedAt(),
				preset.getUpdatedBy());
	}

}
