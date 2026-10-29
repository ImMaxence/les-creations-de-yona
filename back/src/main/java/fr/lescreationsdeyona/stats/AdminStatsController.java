package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Stats")
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
class AdminStatsController {

	private final StatsService statsService;

	@Operation(summary = "Figures of the dashboard: recipes, categories, ingredients, photos and storage",
			description = "Computed on each request; the storage part lists the whole image bucket.")
	@GetMapping
	SiteStats getStats() {
		return statsService.compute();
	}

	@Operation(summary = "Memory and processor in use now, alone: light enough to be asked every second (live curves)",
			description = "The processor load is the one since the previous measure, so polling gives the load of each interval.")
	@GetMapping("/server")
	ServerUsage getServerUsage() {
		return ServerUsage.now();
	}

}
