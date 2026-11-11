package fr.lescreationsdeyona.theme;

import org.jspecify.annotations.Nullable;

public record ThemeResponse(ThemePreset preset, DisplayFont displayFont, BodyFont bodyFont, int radiusPx,
		@Nullable CustomColors customColors) {
}