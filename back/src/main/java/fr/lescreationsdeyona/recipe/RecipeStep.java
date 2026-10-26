package fr.lescreationsdeyona.recipe;

import jakarta.persistence.Embeddable;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A step of a recipe part; its order is the position in {@link RecipePart#getSteps()}.
 *
 * @param ingredientPositions ingredients the step needs, by position in its part's list; empty when
 *     the step does not say
 */
@Embeddable
public record RecipeStep(String description, Integer durationMinutes,
		@JdbcTypeCode(SqlTypes.ARRAY) List<Integer> ingredientPositions) {
}
