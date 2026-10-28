package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.image.ImageChoice;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Menus")
@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
class AdminMenuController {

	private final MenuService menuService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "All menus, published or not, the latest updated first")
	@GetMapping
	List<MenuSummary> listAdminMenus() {
		return menuService.listAll();
	}

	@Operation(summary = "A menu and all its recipes, drafts included")
	@GetMapping("/{id}")
	AdminMenu getAdminMenu(@PathVariable long id) {
		return menuService.get(id);
	}

	@Operation(summary = "Create a menu")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminMenu createMenu(@Valid @RequestBody MenuForm form) {
		return menuService.create(form);
	}

	@Operation(summary = "Update a menu (its slug does not change)")
	@PutMapping("/{id}")
	AdminMenu updateMenu(@PathVariable long id, @Valid @RequestBody MenuForm form) {
		return menuService.update(id, form);
	}

	@Operation(summary = "Upload a new photo for a menu; the previous one stays in the gallery",
			description = "JPEG or PNG, 10 MB max, landscape: at least 1200 × 800 px and 4:3.")
	@PutMapping(path = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	AdminMenu replaceMenuImage(@PathVariable long id, @RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		return menuService.replaceImage(id, imageProcessor.process(file));
	}

	@Operation(summary = "Show an image of the gallery on a menu, or none (the photo of its first recipe)")
	@PutMapping("/{id}/image-choice")
	AdminMenu chooseMenuImage(@PathVariable long id, @RequestBody ImageChoice choice) {
		return menuService.chooseImage(id, choice.imageId());
	}

	@Operation(summary = "Move a menu to the trash, kept 30 days; its recipes stay")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteMenu(@PathVariable long id) {
		menuService.delete(id);
	}

}
