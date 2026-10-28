package fr.lescreationsdeyona.ingredient;

import org.jspecify.annotations.Nullable;

/** An ingredient in the trash, as JSON: only an ingredient no recipe uses can be deleted. */
record TrashedIngredient(String name, @Nullable Aisle aisle) {
}
