package fr.lescreationsdeyona.theme;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A name, unique (case and accents ignored), and the look it holds. */
public record AppearancePresetForm(@NotBlank @Size(max = 50) String name, @Valid @NotNull ThemeForm theme) {
}
