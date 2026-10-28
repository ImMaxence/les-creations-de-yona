package fr.lescreationsdeyona.ingredient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.trash.TrashBin;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class IngredientAisleTest {

	private final IngredientRepository repository = mock(IngredientRepository.class);

	private final IngredientService service = new IngredientService(repository, mock(TrashBin.class), mock(AuditLog.class));

	private static Ingredient ingredient(long id, String name, Aisle aisle) {
		Ingredient ingredient = new Ingredient();
		ingredient.setId(id);
		ingredient.setName(name);
		ingredient.setAisle(aisle);
		return ingredient;
	}

	@Test
	void shelvesASelectionInAnAisle() {
		Ingredient butter = ingredient(1, "Beurre", null);
		Ingredient cream = ingredient(2, "Crème", Aisle.SWEET_GROCERY);
		when(repository.findAllById(List.of(1L, 2L))).thenReturn(List.of(butter, cream));

		service.setAisle(List.of(1L, 2L), Aisle.DAIRY_EGGS);

		assertThat(butter.getAisle()).isEqualTo(Aisle.DAIRY_EGGS);
		assertThat(cream.getAisle()).isEqualTo(Aisle.DAIRY_EGGS);
	}

	@Test
	void takesThemOutOfAnyAisle() {
		Ingredient butter = ingredient(1, "Beurre", Aisle.DAIRY_EGGS);
		when(repository.findAllById(List.of(1L))).thenReturn(List.of(butter));

		service.setAisle(List.of(1L), null);

		assertThat(butter.getAisle()).isNull();
	}

	@Test
	void refusesAnUnknownIngredient() {
		when(repository.findAllById(List.of(1L, 9L))).thenReturn(List.of(ingredient(1, "Beurre", null)));

		assertThatThrownBy(() -> service.setAisle(List.of(1L, 9L), Aisle.DAIRY_EGGS)).isInstanceOf(ApiException.class);
	}

	@Test
	void mergingKeepsTheAisleOfAMergedOneWhenTheKeptOneHasNone() {
		Ingredient kept = ingredient(1, "Pommes", null);
		Ingredient merged = ingredient(2, "pomme", Aisle.FRUITS_VEGETABLES);
		when(repository.findAllById(Set.of(1L, 2L))).thenReturn(List.of(kept, merged));
		when(repository.findById(1L)).thenReturn(Optional.of(kept));
		when(repository.findRecipesListingTwiceAny(any())).thenReturn(List.of());
		when(repository.findAllById(Set.of(2L))).thenReturn(List.of(merged));

		service.merge(new IngredientMergeForm(List.of(1L, 2L), 1L, null));

		assertThat(kept.getAisle()).isEqualTo(Aisle.FRUITS_VEGETABLES);
	}

	@Test
	void mergingKeepsTheAisleOfTheKeptOne() {
		Ingredient kept = ingredient(1, "Pommes", Aisle.FRUITS_VEGETABLES);
		Ingredient merged = ingredient(2, "pomme", Aisle.FROZEN);
		when(repository.findAllById(anyCollection())).thenReturn(List.of(kept, merged));
		when(repository.findById(1L)).thenReturn(Optional.of(kept));
		when(repository.findRecipesListingTwiceAny(any())).thenReturn(List.of());

		service.merge(new IngredientMergeForm(List.of(1L, 2L), 1L, null));

		assertThat(kept.getAisle()).isEqualTo(Aisle.FRUITS_VEGETABLES);
	}

}
