package fr.lescreationsdeyona.theme;

import java.time.Instant;

public record AppearancePresetResponse(Long id, String name, ThemeResponse theme, Instant updatedAt, String updatedBy) {
}
