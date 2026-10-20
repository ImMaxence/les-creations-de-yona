package fr.lescreationsdeyona.ingredient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record IngredientForm(@NotBlank @Size(max = 100) String name) {
}
