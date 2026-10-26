package fr.lescreationsdeyona.theme;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Appearance presets")
@RestController
@RequestMapping("/api/admin/appearance-presets")
@RequiredArgsConstructor
class AdminAppearancePresetController {

	private final AppearancePresetService appearancePresetService;

	@Operation(summary = "Looks saved under a name, sorted by name")
	@GetMapping
	List<AppearancePresetResponse> listAppearancePresets() {
		return appearancePresetService.list();
	}

	@Operation(summary = "Save a look under a name; the site's look does not change")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AppearancePresetResponse createAppearancePreset(@Valid @RequestBody AppearancePresetForm form) {
		return appearancePresetService.create(form);
	}

	@Operation(summary = "Rename a saved look, or replace what it holds")
	@PutMapping("/{id}")
	AppearancePresetResponse updateAppearancePreset(@PathVariable long id, @Valid @RequestBody AppearancePresetForm form) {
		return appearancePresetService.update(id, form);
	}

	@Operation(summary = "Delete a saved look; the site's look does not change")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAppearancePreset(@PathVariable long id) {
		appearancePresetService.delete(id);
	}

}
