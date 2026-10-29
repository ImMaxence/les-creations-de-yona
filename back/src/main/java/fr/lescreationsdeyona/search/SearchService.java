package fr.lescreationsdeyona.search;

import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.SearchWords;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.recipe.RecipeService;
import fr.lescreationsdeyona.recipe.RecipeTheme;
import fr.lescreationsdeyona.tag.TagService;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Suggestions of the search box: "petit déjeuner" suggests the recipes, but also the category, the
 * tag, the menu or the ingredient of that name; "gâteau au yaourt" the ingredient "Yaourt"; "cake
 * salé" the savory theme. Categories, tags, menus and ingredients are few: read whole and matched
 * here, with the same words as the recipe search.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {

	private static final int OTHER_LIMIT = 3;

	/** As the site names them, folded: what a search for a theme begins with. */
	private static final Map<RecipeTheme, String> THEME_NAMES = Map.of(RecipeTheme.SWEET, "sucre", RecipeTheme.SAVORY, "sale");

	private final RecipeService recipeService;

	private final CategoryRepository categoryRepository;

	private final TagService tagService;

	private final MenuService menuService;

	private final IngredientService ingredientService;

	@Cacheable(PublicCache.SEARCH_SUGGESTIONS)
	public SearchSuggestions suggest(String text) {
		List<String> words = SearchWords.of(text);
		String typedTheme = SearchWords.theme(text);
		if (words.isEmpty() && typedTheme == null) {
			return new SearchSuggestions(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
		}
		List<RecipeTheme> themes = typedTheme != null ? List.of(RecipeTheme.valueOf(typedTheme)) : themesBeginning(text);
		Set<String> publishedCategories = Set.copyOf(categoryRepository.findSlugsWithPublishedRecipes());
		List<SearchSuggestions.Named> categories = matching(
				categoryRepository.findAll(Sort.by("name")).stream().filter(category -> publishedCategories.contains(category.getSlug())),
				words, category -> new SearchSuggestions.Named(category.getName(), category.getSlug()));
		List<SearchSuggestions.Named> tags = matching(tagService.listPublic().stream().filter(tag -> tag.recipeCount() > 0), words,
				tag -> new SearchSuggestions.Named(tag.name(), tag.slug()));
		List<SearchSuggestions.Named> menus = matching(menuService.listPublished().stream(), words,
				menu -> new SearchSuggestions.Named(menu.title(), menu.slug()));
		List<String> ingredients = ingredientService.publishedNames()
			.stream()
			.sorted()
			.filter(name -> SearchWords.allIn(words, name) || SearchWords.isOneOf(words, name))
			.limit(OTHER_LIMIT)
			.toList();
		return new SearchSuggestions(recipeService.suggest(text), themes, categories, tags, menus, ingredients);
	}

	/** "sal" suggests "Salé", "su" "Sucré": a single word, two letters at least. */
	private static List<RecipeTheme> themesBeginning(String text) {
		String folded = Texts.foldCaseAndAccents(text).strip();
		if (folded.length() < 2 || folded.contains(" ")) {
			return List.of();
		}
		return Arrays.stream(RecipeTheme.values()).filter(theme -> THEME_NAMES.get(theme).startsWith(folded)).toList();
	}

	/** Those whose name holds each word, the first ones. */
	private static <T, R> List<R> matching(Stream<T> items, List<String> words, Function<T, R> toSuggestion) {
		return items.map(toSuggestion)
			.filter(suggestion -> SearchWords.allIn(words, nameOf(suggestion)))
			.limit(OTHER_LIMIT)
			.toList();
	}

	private static String nameOf(Object suggestion) {
		return suggestion instanceof SearchSuggestions.Named named ? named.name() : suggestion.toString();
	}

}
