package fr.lescreationsdeyona.theme;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ThemeForm(@NotNull ThemePreset preset, @NotNull DisplayFont displayFont, @NotNull BodyFont bodyFont,
		@Min(0) @Max(999) int radiusPx) {
}