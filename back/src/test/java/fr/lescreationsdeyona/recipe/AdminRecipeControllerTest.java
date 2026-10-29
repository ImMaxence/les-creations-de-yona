package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.image.ImageProcessor;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class AdminRecipeControllerTest {

	private final RecipeService recipeService = mock(RecipeService.class);

	private final AdminRecipeController controller = new AdminRecipeController(recipeService, mock(ImageProcessor.class));

	private final Pageable firstPage = PageRequest.of(0, 20);

	@Test
	void tellsTheScheduledDraftsFromTheOthers() {
		when(recipeService.searchAll(any(), any())).thenReturn(Page.empty(firstPage));

		// "Programmées": the drafts with a publication time; "Brouillons": those without
		controller.searchRecipes(null, null, null, null, null, RecipeStatus.DRAFT, RecipeTheme.SAVORY, true, firstPage);

		ArgumentCaptor<RecipeFilter> filter = ArgumentCaptor.forClass(RecipeFilter.class);
		verify(recipeService).searchAll(filter.capture(), any());
		assertThat(filter.getValue().status()).isEqualTo(RecipeStatus.DRAFT);
		assertThat(filter.getValue().scheduled()).isTrue();
		assertThat(filter.getValue().theme()).isEqualTo(RecipeTheme.SAVORY);
		assertThat(RecipeFilter.publishedText("tarte").scheduled()).isNull();
	}

}
