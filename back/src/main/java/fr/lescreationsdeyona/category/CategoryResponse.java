package fr.lescreationsdeyona.category;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record CategoryResponse(Long id, String name, String slug, @Nullable UUID imageId) {
}
