package fr.lescreationsdeyona.recipe;

import jakarta.persistence.Embeddable;

/** A step of a recipe; its order is the position in {@link Recipe#getSteps()}. */
@Embeddable
public record RecipeStep(String description, Integer durationMinutes) {
}
