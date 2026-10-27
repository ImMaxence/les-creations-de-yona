package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.menu.MenuResponses.AdminMenu;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Menus")
@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
class AdminMenuController {

	private final MenuService menuService;

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

	@Operation(summary = "Move a menu to the trash, kept 30 days; its recipes stay")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteMenu(@PathVariable long id) {
		menuService.delete(id);
	}

}
