package fr.lescreationsdeyona.theme;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Theme")
@RestController
@RequestMapping("/api/theme")
@RequiredArgsConstructor
class ThemeController {

	private final ThemeService themeService;

	@Operation(summary = "Look of the site: color theme, fonts and corner radius")
	@GetMapping
	ThemeResponse getTheme() {
		return themeService.get();
	}

}