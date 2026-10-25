package fr.lescreationsdeyona.content;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The texts; the photo has its own routes, like the photos of recipes and categories. */
public record SiteContentForm(
		@NotBlank @Size(max = 80) String aboutTitle,
		@Schema(description = "Plain text; a blank line starts a new paragraph") @NotBlank @Size(max = 1500)
		String aboutText,
		@NotBlank @Size(max = 200) String footerText) {
}
