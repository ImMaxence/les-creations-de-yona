package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuResponses.MenuDetail;
import fr.lescreationsdeyona.menu.MenuResponses.MenuRecipe;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeMapper;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MenuService {

	private final MenuRepository menuRepository;

	private final RecipeRepository recipeRepository;

	private final RecipeMapper recipeMapper;

	// Public site: published menus, their published recipes only

	/** The latest updated first; a menu without published recipe is left out. */
	public List<MenuSummary> listPublished() {
		return menuRepository.findByPublishedTrueOrderByUpdatedAtDesc()
			.stream()
			.map(menu -> summary(menu, true))
			.filter(summary -> summary.recipeCount() > 0)
			.toList();
	}

	public MenuDetail getPublished(String slug) {
		Menu menu = menuRepository.findBySlugAndPublishedTrue(slug)
			.orElseThrow(() -> new ApiException(ErrorCode.MENU_NOT_FOUND));
		List<Recipe> recipes = published(menu);
		if (recipes.isEmpty()) {
			throw new ApiException(ErrorCode.MENU_NOT_FOUND);
		}
		return new MenuDetail(menu.getTitle(), menu.getSlug(), menu.getIntro(),
				recipes.stream().map(recipeMapper::toCard).toList(), menu.getUpdatedAt());
	}

	// Back-office

	public List<MenuSummary> listAll() {
		return menuRepository.findAllByOrderByUpdatedAtDesc().stream().map(menu -> summary(menu, false)).toList();
	}

	public AdminMenu get(long id) {
		return toAdmin(find(id));
	}

	@Transactional
	public AdminMenu create(MenuForm form) {
		String title = title(form);
		if (menuRepository.findByTitle(title).isPresent()) {
			throw new ApiException(ErrorCode.MENU_ALREADY_EXISTS);
		}
		Menu menu = new Menu();
		menu.setSlug(Slugs.uniqueSlug(title, "menu", menuRepository::existsBySlug));
		return save(menu, title, form);
	}

	@Transactional
	public AdminMenu update(long id, MenuForm form) {
		Menu menu = find(id);
		String title = title(form);
		if (menuRepository.findByTitle(title).filter(other -> !other.getId().equals(id)).isPresent()) {
			throw new ApiException(ErrorCode.MENU_ALREADY_EXISTS);
		}
		return save(menu, title, form);
	}

	@Transactional
	public void delete(long id) {
		menuRepository.delete(find(id));
	}

	private AdminMenu save(Menu menu, String title, MenuForm form) {
		menu.setTitle(title);
		menu.setIntro(StringUtils.hasText(form.intro()) ? form.intro().strip() : null);
		menu.setPublished(form.published());
		menu.getRecipes().clear();
		menu.getRecipes().addAll(recipes(form.recipeIds()));
		return toAdmin(menuRepository.saveAndFlush(menu));
	}

	/** In the order given, each once. */
	private List<Recipe> recipes(Collection<Long> ids) {
		Map<Long, Recipe> byId = recipeRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Recipe::getId, Function.identity()));
		return ids.stream()
			.distinct()
			.map(id -> Optional.ofNullable(byId.get(id)).orElseThrow(() -> new ApiException(ErrorCode.MENU_RECIPE_NOT_FOUND)))
			.toList();
	}

	private MenuSummary summary(Menu menu, boolean publishedOnly) {
		List<Recipe> recipes = publishedOnly ? published(menu) : menu.getRecipes();
		return new MenuSummary(menu.getId(), menu.getTitle(), menu.getSlug(), menu.getIntro(), menu.isPublished(),
				recipes.size(),
				recipes.stream().map(Recipe::getImage).filter(Objects::nonNull).map(Image::getId).findFirst().orElse(null),
				menu.getUpdatedAt());
	}

	private static List<Recipe> published(Menu menu) {
		return menu.getRecipes().stream().filter(recipe -> recipe.getStatus() == RecipeStatus.PUBLISHED).toList();
	}

	private static AdminMenu toAdmin(Menu menu) {
		return new AdminMenu(menu.getId(), menu.getTitle(), menu.getSlug(), menu.getIntro(), menu.isPublished(),
				menu.getRecipes()
					.stream()
					.map(recipe -> new MenuRecipe(recipe.getId(), recipe.getTitle(), recipe.getStatus()))
					.toList(),
				menu.getUpdatedAt());
	}

	private Menu find(long id) {
		return menuRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.MENU_NOT_FOUND));
	}

	private static String title(MenuForm form) {
		return Texts.capitalizeFirstLetter(form.title().strip());
	}

}
