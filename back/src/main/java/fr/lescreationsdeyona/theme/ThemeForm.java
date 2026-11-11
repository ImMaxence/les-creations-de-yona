package fr.lescreationsdeyona.theme;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.jspecify.annotations.Nullable;

/** {@code customColors}: required with the preset PERSONNALISE, kept otherwise (choosing it again finds them). */
public record ThemeForm(@NotNull ThemePreset preset, @NotNull DisplayFont displayFont, @NotNull BodyFont bodyFont,
		@Min(0) @Max(999) int radiusPx, @Valid @Nullable CustomColors customColors) {
}