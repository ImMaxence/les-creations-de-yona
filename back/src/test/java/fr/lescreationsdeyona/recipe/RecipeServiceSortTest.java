package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.tag.TagService;
import fr.lescreationsdeyona.trash.TrashBin;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/** The orders the back-office list sends (see admin-recipes.ts), and those the public site may not use. */
class RecipeServiceSortTest {

	private final RecipeRepository recipeRepository = mock(RecipeRepository.class);

	private final RecipeService service = new RecipeService(recipeRepository, mock(CategoryRepository.class),
			mock(IngredientService.class), mock(ImageService.class), mock(TagService.class), mock(MenuService.class),
			mock(TrashBin.class), mock(RecipeMapper.class), mock(ApplicationEventPublisher.class), mock(AuditLog.class));

	private final RecipeFilter noFilter = new RecipeFilter(null, null, null, null, List.of(), null, null, null, null, null, null);

	@SuppressWarnings("unchecked")
	private void anyPageIsEmpty() {
		when(recipeRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
	}

	private static Pageable sortedBy(String property) {
		return PageRequest.of(0, 20, Sort.by(Sort.Order.desc(property), Sort.Order.desc("id")));
	}

	@Test
	void sortsTheBackOfficeListByEveryOrderItOffers() {
		anyPageIsEmpty();

		for (String property : List.of("updatedAt", "createdAt", "title", "viewCount")) {
			assertThatCode(() -> service.searchAll(noFilter, sortedBy(property))).as(property).doesNotThrowAnyException();
		}
	}

	@Test
	void keepsTheViewsOutOfThePublicOrders() {
		anyPageIsEmpty();

		assertThatThrownBy(() -> service.searchPublished(noFilter, sortedBy("viewCount")))
			.isInstanceOf(ApiException.class)
			.extracting("code")
			.isEqualTo(ErrorCode.INVALID_SORT);
	}

}
