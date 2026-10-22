package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Images")
@RestController
@RequestMapping("/api/admin/images")
@RequiredArgsConstructor
class AdminImageController {

	private final ImageService imageService;

	@Operation(summary = "Gallery: every image, with the recipes and categories showing it",
			description = "Sort on createdAt only. used=false lists the images shown nowhere.")
	@GetMapping
	PageResponse<GalleryImage> listImages(@RequestParam(required = false) @Nullable ImageKind kind,
			@RequestParam(required = false) @Nullable Boolean used,
			@ParameterObject @PageableDefault(size = 24, sort = "createdAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		return PageResponse.of(imageService.gallery(kind, used, pageable));
	}

	@Operation(summary = "Delete an image; the recipes and categories showing it fall back to the default visual")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteImage(@PathVariable UUID id) {
		imageService.delete(id);
	}

}
