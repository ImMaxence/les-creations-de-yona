package fr.lescreationsdeyona.menu;

import fr.lescreationsdeyona.menu.MenuResponses.MenuDetail;
import fr.lescreationsdeyona.menu.MenuResponses.MenuSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Menus")
@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
class MenuController {

	private final MenuService menuService;

	@Operation(summary = "Published menus having a published recipe, the latest updated first")
	@GetMapping
	List<MenuSummary> listMenus() {
		return menuService.listPublished();
	}

	@Operation(summary = "A published menu and its published recipes, in order; 404 otherwise")
	@GetMapping("/{slug}")
	MenuDetail getMenu(@PathVariable String slug) {
		return menuService.getPublished(slug);
	}

}
