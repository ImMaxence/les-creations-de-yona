package fr.lescreationsdeyona.image;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Images")
@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
class ImageController {

	private static final String WEBP = "image/webp";

	// An image never changes: a new photo gets a new id, hence a new URL.
	private static final CacheControl CACHE_FOREVER = CacheControl.maxAge(Duration.ofDays(365))
		.cachePublic()
		.immutable();

	private final ImageService imageService;

	@Operation(summary = "An image, 800 or 1600 px wide", description = "Built from the imageId of a recipe or category.",
			responses = @ApiResponse(responseCode = "200",
					content = @Content(mediaType = WEBP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/{id}/{width:800|1600}.webp")
	ResponseEntity<InputStreamResource> getImage(@PathVariable UUID id, @PathVariable int width) {
		ImageStorage.StoredFile file = imageService.open(id, width);
		return ResponseEntity.ok()
			.cacheControl(CACHE_FOREVER)
			.contentType(MediaType.parseMediaType(WEBP))
			.contentLength(file.size())
			.body(new InputStreamResource(file.content()));
	}

}
