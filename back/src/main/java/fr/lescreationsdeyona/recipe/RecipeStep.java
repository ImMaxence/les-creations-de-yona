package fr.lescreationsdeyona.recipe;

import jakarta.persistence.Embeddable;

/** A step of a recipe part; its order is the position in {@link RecipePart#getSteps()}. */
@Embeddable
public record RecipeStep(String description, Integer durationMinutes) {
}
