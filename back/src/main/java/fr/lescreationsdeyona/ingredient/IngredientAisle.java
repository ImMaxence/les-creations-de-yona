package fr.lescreationsdeyona.ingredient;

/** The shop aisle of an ingredient, by name: the shopping list keeps names, not ids. */
public record IngredientAisle(String name, Aisle aisle) {
}
