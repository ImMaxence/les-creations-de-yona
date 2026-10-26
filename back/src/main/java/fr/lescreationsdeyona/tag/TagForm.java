package fr.lescreationsdeyona.tag;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Creation or renaming of a tag. Its first letter is capitalized. The slug is generated at
 * creation and never changes after.
 */
public record TagForm(@NotBlank @Size(max = 40) String name) {
}
