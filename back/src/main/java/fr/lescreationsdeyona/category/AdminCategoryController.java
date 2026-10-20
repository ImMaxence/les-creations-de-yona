package fr.lescreationsdeyona.category;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Categories")
@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
class AdminCategoryController {

	private final CategoryService categoryService;

	@Operation(summary = "Create a category")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	CategoryResponse createCategory(@Valid @RequestBody CategoryForm form) {
		return categoryService.create(form);
	}

	@Operation(summary = "Rename a category (its slug does not change)")
	@PutMapping("/{id}")
	CategoryResponse renameCategory(@PathVariable long id, @Valid @RequestBody CategoryForm form) {
		return categoryService.rename(id, form);
	}

	@Operation(summary = "Delete a category; refused while it still contains recipes")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteCategory(@PathVariable long id) {
		categoryService.delete(id);
	}

}
