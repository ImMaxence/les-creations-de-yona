package fr.lescreationsdeyona.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Creation or renaming of a category. Its first letter is capitalized. The slug is generated at
 * creation and never changes after.
 */
public record CategoryForm(@NotBlank @Size(max = 60) String name) {
}
