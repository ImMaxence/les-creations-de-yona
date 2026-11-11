package fr.lescreationsdeyona.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;
import org.springframework.web.multipart.MultipartFile;

/** Notes for an article: typed, the photo of handwritten ones, or both (multipart form); the shape wanted, who writes. */
public record CapAiRequest(@Schema(description = "20,000 characters at most") @Nullable String text,
		@Schema(description = "JPEG or PNG, 10 MB max") @Nullable MultipartFile image,
		@Schema(description = "AUTO when absent") @Nullable CapAiForm form,
		@Schema(description = "GEMINI when absent") @Nullable AiEngine engine) {
}
