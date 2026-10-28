package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;
import org.springframework.web.multipart.MultipartFile;

/** What to read: a pasted text, a photo, or both (multipart form). */
public record RecipeAiRequest(@Schema(description = "20,000 characters at most") @Nullable String text,
		@Schema(description = "JPEG or PNG, 10 MB max") @Nullable MultipartFile image) {
}
