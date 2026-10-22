package fr.lescreationsdeyona.theme;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Theme")
@RestController
@RequestMapping("/api/admin/theme")
@RequiredArgsConstructor
class AdminThemeController {

	private final ThemeService themeService;

	@Operation(summary = "Change the look of the site for every visitor")
	@PutMapping
	ThemeResponse updateTheme(@Valid @RequestBody ThemeForm form) {
		return themeService.update(form);
	}

}