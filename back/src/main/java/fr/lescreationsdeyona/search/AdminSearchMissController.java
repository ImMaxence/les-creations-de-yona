package fr.lescreationsdeyona.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The searches themselves are listed in the statistics (GET /api/admin/stats). */
@Tag(name = "Admin - Search misses")
@RestController
@RequestMapping("/api/admin/search-misses")
@RequiredArgsConstructor
class AdminSearchMissController {

	private final SearchMissService searchMissService;

	@Operation(summary = "Forget a search without result, or all of them")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteSearchMisses(@Parameter(description = "The text to forget; absent: every one")
	@RequestParam(required = false) @Size(max = 100) @Nullable String term) {
		searchMissService.delete(term);
	}

}
