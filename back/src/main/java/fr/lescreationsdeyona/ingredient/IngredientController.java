package fr.lescreationsdeyona.ingredient;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Ingredients")
@RestController
@RequestMapping("/api/ingredients")
@RequiredArgsConstructor
class IngredientController {

	private final IngredientService ingredientService;

	@Operation(summary = "Names of the ingredients of the published recipes, sorted",
			description = "Choices of the ingredient filter of GET /api/recipes.")
	@GetMapping
	List<String> listPublishedIngredients() {
		return ingredientService.publishedNames();
	}

	@Operation(summary = "Shop aisles of the ingredients of the published recipes, those set in the back-office",
			description = "Read by the shopping list when shown, which sorts its ingredients by aisle: an aisle set "
					+ "later applies to the lists already made. An ingredient without aisle is absent.")
	@GetMapping("/aisles")
	List<IngredientAisle> listIngredientAisles() {
		return ingredientService.publishedAisles();
	}

}
