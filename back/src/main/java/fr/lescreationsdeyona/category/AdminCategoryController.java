package fr.lescreationsdeyona.category;

import fr.lescreationsdeyona.image.ImageChoice;
import fr.lescreationsdeyona.image.ImageProcessor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Categories")
@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
class AdminCategoryController {

	private final CategoryService categoryService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "Create a category")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	CategoryResponse createCategory(@Valid @RequestBody CategoryForm form) {
		return categoryService.create(form);
	}

	@Operation(summary = "Rename a category (its slug does not change), or change its theme",
			description = "A new theme goes to every recipe whose main category it is.")
	@PutMapping("/{id}")
	CategoryResponse updateCategory(@PathVariable long id, @Valid @RequestBody CategoryForm form) {
		return categoryService.update(id, form);
	}

	@Operation(summary = "Move several categories to the trash, all or none; refused while one still contains recipes")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteCategories(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids) {
		categoryService.deleteAll(ids);
	}

	@Operation(summary = "Move a category to the trash, kept 30 days; refused while it still contains recipes. Its photo stays in the gallery")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteCategory(@PathVariable long id) {
		categoryService.delete(id);
	}

	@Operation(summary = "Upload a new photo for a category; the previous one stays in the gallery",
			description = "JPEG or PNG, 10 MB max, landscape: at least 1200 × 800 px and 4:3.")
	@PutMapping(path = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	CategoryResponse replaceCategoryImage(@PathVariable long id, @RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		return categoryService.replaceImage(id, imageProcessor.process(file));
	}

	@Operation(summary = "Show an image of the gallery on a category, or none (default visual)")
	@PutMapping("/{id}/image-choice")
	CategoryResponse chooseCategoryImage(@PathVariable long id, @RequestBody ImageChoice choice) {
		return categoryService.chooseImage(id, choice.imageId());
	}

}
