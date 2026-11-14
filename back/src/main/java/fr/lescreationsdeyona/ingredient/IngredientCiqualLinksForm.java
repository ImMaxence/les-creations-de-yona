package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/** "Tout lier": each ingredient to the Ciqual food chosen for it, all at once. */
public record IngredientCiqualLinksForm(@NotEmpty @Size(max = 500) List<@Valid @NotNull Link> links) {

	/** Named apart: the OpenAPI description names it after the record, and a "Link" exists (social links). */
	@Schema(name = "IngredientCiqualLink")
	public record Link(@NotNull Long ingredientId, @NotNull @Positive Integer ciqualCode) {
	}

}
