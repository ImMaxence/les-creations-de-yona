package fr.lescreationsdeyona.recipe;

import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A question visitors ask about the recipe, with Yona's answer ("Peut-on la congeler ?"): shown
 * under the recipe, and as FAQPage for search engines. Plain text. Its order is the position in
 * {@link Recipe#getQuestions()}; the same record in the form and in the API's answer.
 */
@Embeddable
public record RecipeQuestion(@NotBlank @Size(max = 200) String question, @NotBlank @Size(max = 2000) String answer) {
}
