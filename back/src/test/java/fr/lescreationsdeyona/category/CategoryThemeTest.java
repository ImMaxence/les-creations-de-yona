package fr.lescreationsdeyona.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import fr.lescreationsdeyona.trash.TrashBin;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.data.domain.Sort;

/** The theme of a category, given to the recipes whose main category it is. */
class CategoryThemeTest {

	private final CategoryRepository categoryRepository = mock(CategoryRepository.class);

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final CategoryMapper categoryMapper = mock(CategoryMapper.class);

	private final CategoryService service = new CategoryService(categoryRepository, recipeRepository, categoryMapper,
			mock(ImageService.class), mock(TrashBin.class), mock(AuditLog.class));

	private final Category aperitifs = new Category();

	@BeforeEach
	void aCategoryHoldingBoth() {
		aperitifs.setId(4L);
		aperitifs.setName("Apéritifs");
		when(categoryRepository.findById(4L)).thenReturn(Optional.of(aperitifs));
		when(categoryRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void givesItsNewThemeToItsRecipesUnfeaturingFirst() {
		service.update(4L, new CategoryForm("Apéritifs", RecipeTheme.SAVORY));

		InOrder order = inOrder(recipeRepository);
		order.verify(recipeRepository).unfeatureMovingTo(4L, "SAVORY");
		order.verify(recipeRepository).giveThemeOfMainCategory(4L, "SAVORY");
		assertThat(aperitifs.getTheme()).isEqualTo(RecipeTheme.SAVORY);
	}

	@Test
	void leavesTheRecipesAloneWhenTheThemeStaysOrGoesBackToBoth() {
		aperitifs.setTheme(RecipeTheme.SWEET);
		service.update(4L, new CategoryForm("Apéritifs sucrés", RecipeTheme.SWEET));
		service.update(4L, new CategoryForm("Apéritifs", null));

		verify(recipeRepository, never()).giveThemeOfMainCategory(anyLong(), anyString());
		assertThat(aperitifs.getTheme()).isNull();
	}

	@Test
	void listsTheThemesOfThePublishedRecipesOfEachCategory() {
		when(categoryRepository.findAll(any(Sort.class))).thenReturn(List.of(aperitifs));
		when(categoryRepository.findPublishedThemes())
			.thenReturn(List.of(new Object[] { 4L, RecipeTheme.SAVORY }, new Object[] { 4L, RecipeTheme.SWEET }));
		when(categoryMapper.toResponse(aperitifs))
			.thenReturn(new CategoryResponse(4L, "Apéritifs", "aperitifs", null, null, List.of()));

		assertThat(service.list().getFirst().publishedThemes()).containsExactlyInAnyOrder(RecipeTheme.SAVORY,
				RecipeTheme.SWEET);
	}

}
