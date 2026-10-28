package fr.lescreationsdeyona.search;

import fr.lescreationsdeyona.category.CategoryRepository;
import fr.lescreationsdeyona.common.SearchWords;
import fr.lescreationsdeyona.ingredient.IngredientService;
import fr.lescreationsdeyona.menu.MenuService;
import fr.lescreationsdeyona.recipe.RecipeService;
import fr.lescreationsdeyona.tag.TagService;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Suggestions of the search box: "petit déjeuner" suggests the recipes, but also the category, the
 * tag, the menu or the ingredient of that name. Categories, tags, menus and ingredients are few:
 * read whole and matched here, with the same words as the recipe search.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {

	private static final int OTHER_LIMIT = 3;

	private final RecipeService recipeService;

	private final CategoryRepository categoryRepository;

	private final TagService tagService;

	private final MenuService menuService;

	private final IngredientService ingredientService;

	public SearchSuggestions suggest(String text) {
		List<String> words = SearchWords.of(text);
		if (words.isEmpty()) {
			return new SearchSuggestions(List.of(), List.of(), List.of(), List.of(), List.of());
		}
		Set<String> publishedCategories = Set.copyOf(categoryRepository.findSlugsWithPublishedRecipes());
		List<SearchSuggestions.Named> categories = matching(
				categoryRepository.findAll(Sort.by("name")).stream().filter(category -> publishedCategories.contains(category.getSlug())),
				words, category -> new SearchSuggestions.Named(category.getName(), category.getSlug()));
		List<SearchSuggestions.Named> tags = matching(tagService.listPublic().stream().filter(tag -> tag.recipeCount() > 0), words,
				tag -> new SearchSuggestions.Named(tag.name(), tag.slug()));
		List<SearchSuggestions.Named> menus = matching(menuService.listPublished().stream(), words,
				menu -> new SearchSuggestions.Named(menu.title(), menu.slug()));
		List<String> ingredients = matching(ingredientService.publishedNames().stream().sorted(), words, Function.identity());
		return new SearchSuggestions(recipeService.suggest(text), categories, tags, menus, ingredients);
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
