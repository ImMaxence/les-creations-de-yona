package fr.lescreationsdeyona.category;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Categories")
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
class CategoryController {

	private final CategoryService categoryService;

	@Operation(summary = "All categories, sorted by name")
	@GetMapping
	List<CategoryResponse> listCategories() {
		return categoryService.list();
	}

}
