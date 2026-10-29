package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Images")
@RestController
@RequestMapping("/api/admin/images")
@RequiredArgsConstructor
class AdminImageController {

	private final ImageService imageService;

	private final ImageProcessor imageProcessor;

	@Operation(summary = "Gallery: every image, with the recipes and categories showing it",
			description = "Sort on createdAt only. used=false lists the images shown nowhere.")
	@GetMapping
	PageResponse<GalleryImage> listImages(@RequestParam(required = false) @Nullable ImageKind kind,
			@Parameter(description = "true: the vertical Pinterest photos only; false: the landscape ones only")
			@RequestParam(required = false) @Nullable Boolean portrait,
			@RequestParam(required = false) @Nullable Boolean used,
			@ParameterObject @PageableDefault(size = 24, sort = "createdAt", direction = Sort.Direction.DESC)
			Pageable pageable) {
		return PageResponse.of(imageService.gallery(kind, portrait, used, pageable));
	}

	@Operation(summary = "Upload a photo to the gallery, shown nowhere until chosen for a recipe or a category",
			description = "JPEG or PNG, 10 MB max, landscape: at least 1200 × 800 px and 4:3.")
	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	GalleryImage uploadImage(@RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		return imageService.upload(imageProcessor.process(file));
	}

	@Operation(summary = "Replace a photo by its retouched version (cropped, turned, lightened…), wherever it is shown",
			description = "JPEG or PNG made by the editor of the back-office from the 1600 px file: at least 800 × 450 px "
					+ "(600 × 800 for a Pinterest photo), same shape rules as an upload. The new photo has a new id; the "
					+ "original goes to the trash.")
	@PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	GalleryImage replaceImage(@PathVariable UUID id, @RequestPart MultipartFile file) {
		// Decoded and encoded before the transaction opens, to hold no database connection meanwhile.
		ProcessedImage retouched = imageProcessor.processEdited(file, imageService.kindOf(id) == ImageKind.PINTEREST);
		return imageService.replace(id, retouched);
	}

	@Operation(summary = "Delete several images, all or none; the recipes and categories showing them fall back to the default visual")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteImages(@RequestParam @NotEmpty @Size(max = 100) List<UUID> ids) {
		imageService.deleteAll(ids);
	}

	@Operation(summary = "Delete an image; the recipes and categories showing it fall back to the default visual")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteImage(@PathVariable UUID id) {
		imageService.delete(id);
	}

}
