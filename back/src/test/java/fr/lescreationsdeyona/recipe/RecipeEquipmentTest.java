package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class RecipeEquipmentTest {

	// Only its default method, called for real
	private final RecipeMapper mapper = Mockito.mock(RecipeMapper.class, Mockito.CALLS_REAL_METHODS);

	@Test
	void keepsOneItemPerLineInOrder() {
		assertThat(RecipeService.equipment(List.of("moule à tarte de 24 cm", "  Fouet ", "Poche à douille")))
			.isEqualTo("Moule à tarte de 24 cm\nFouet\nPoche à douille");
	}

	@Test
	void dropsBlanksRepeatsAndLineBreaks() {
		assertThat(RecipeService.equipment(List.of("Fouet", " ", "fouet", "Poche\nà douille")))
			.isEqualTo("Fouet\nPoche à douille");
	}

	@Test
	void storesNothingForNoEquipment() {
		assertThat(RecipeService.equipment(null)).isNull();
		assertThat(RecipeService.equipment(List.of())).isNull();
		assertThat(RecipeService.equipment(Arrays.asList(" ", ""))).isNull();
	}

	@Test
	void readsTheLinesBack() {
		assertThat(mapper.lines("Moule à tarte\nFouet\n\n")).containsExactly("Moule à tarte", "Fouet");
		assertThat(mapper.lines(null)).isEmpty();
	}

}
