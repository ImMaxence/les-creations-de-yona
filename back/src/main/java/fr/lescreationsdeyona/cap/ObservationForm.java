package fr.lescreationsdeyona.cap;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** An observation, about a recipe or about none. Its photo comes from the gallery. */
public record ObservationForm(
		@NotBlank @Size(max = 150) String title,
		@Schema(description = "Markdown") @NotBlank @Size(max = 5000) String body,
		@NotNull LocalDate observedOn,
		@Schema(description = "A landscape photo of the gallery") @Nullable UUID imageId,
		@Schema(description = "Absent for \"Pas de recette\"") @Nullable Long recipeId,
		@NotNull Boolean published) {
}
