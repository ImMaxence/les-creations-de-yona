package fr.lescreationsdeyona.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Search")
@RestController
@RequestMapping("/api/search-suggestions")
@RequiredArgsConstructor
class SearchController {

	private final SearchService searchService;

	@Operation(summary = "Suggestions of the search box: recipes, categories, tags, menus and ingredients matching each word")
	@GetMapping
	SearchSuggestions suggest(@RequestParam @NotBlank @Size(min = 2, max = 100) String q) {
		return searchService.suggest(q);
	}

}
