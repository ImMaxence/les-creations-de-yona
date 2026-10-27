package fr.lescreationsdeyona.menu;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Creation or update of a menu. Its first letter is capitalized; its slug never changes. */
public record MenuForm(
		@NotBlank @Size(max = 100) String title,
		@Schema(description = "A few words on the occasion, shown on its page") @Size(max = 1000) @Nullable String intro,
		@NotNull Boolean published,
		@Schema(description = "In order, each once; drafts allowed, shown on the site once published")
		@NotEmpty @Size(max = 12) List<@NotNull Long> recipeIds) {
}
