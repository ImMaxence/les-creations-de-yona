package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.image.ImageStorage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Trash")
@RestController
@RequestMapping("/api/admin/trash")
@RequiredArgsConstructor
class AdminTrashController {

	private static final String WEBP = "image/webp";

	private final TrashService trashService;

	@Operation(summary = "Deleted recipes, categories, menus and photos, kept 30 days; the last deleted first")
	@GetMapping
	List<TrashedItem> listTrash() {
		return trashService.list();
	}

	@Operation(summary = "Restore something deleted",
			description = "A recipe: same URL if still free, same dates and views, its photos, categories and tags that "
					+ "still exist, back in its menus; refused when none of its categories exists any more. A category: "
					+ "same name, its photo. A menu: its recipes that still exist; refused when its title is taken. "
					+ "A photo: back in the gallery, and where it was shown if nothing else has been chosen there.")
	@PostMapping("/{id}/restore")
	TrashRestored restoreFromTrash(@PathVariable long id) {
		return trashService.restore(id);
	}

	@Operation(summary = "A deleted photo, 800 px wide, to show it in the trash",
			responses = @ApiResponse(responseCode = "200",
					content = @Content(mediaType = WEBP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/{id}/image")
	ResponseEntity<InputStreamResource> getTrashedImage(@PathVariable long id) {
		ImageStorage.StoredFile file = trashService.openImage(id);
		return ResponseEntity.ok()
			.cacheControl(CacheControl.noStore())
			.contentType(MediaType.parseMediaType(WEBP))
			.contentLength(file.size())
			.body(new InputStreamResource(file.content()));
	}

	@Operation(summary = "Erase something deleted for good",
			description = "A recipe's or a category's photo stays in the gallery; a photo's files are deleted.")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void eraseFromTrash(@PathVariable long id) {
		trashService.erase(id);
	}

	@Operation(summary = "Empty the trash")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void emptyTrash() {
		trashService.eraseAll();
	}

}
