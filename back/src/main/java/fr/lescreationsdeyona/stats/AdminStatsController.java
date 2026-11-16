package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Stats")
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
@Validated
class AdminStatsController {

	private final StatsService statsService;

	private final SiteHealthService siteHealthService;

	private final ServerHistory serverHistory;

	private final MachineCounters machineCounters;

	@Operation(summary = "Figures of the dashboard: recipes, categories, ingredients, photos and storage",
			description = "Computed on each request; the storage part lists the whole image bucket.")
	@GetMapping
	SiteStats getStats() {
		return statsService.compute();
	}

	@Operation(summary = "Memory and processor in use now, alone: light enough to be asked every second (live curves)",
			description = "The processor load is the one since the previous measure, so polling gives the load of each interval; "
					+ "sinceLast (2.21): the whole server since the previous measure, its estimated draw and the traffic.")
	@GetMapping("/server")
	ServerUsage getServerUsage() {
		return ServerUsage.now(machineCounters.measure().rates());
	}

	@Operation(summary = "Memory, processor, estimated draw and traffic over the last days, measured every 10 minutes (kept 90 days)",
			description = "180 points at most: averages of the processor, the draw and the traffic, peaks of the memory of each slice, "
					+ "the oldest first; and the totals of the period (2.21).")
	@GetMapping("/server/history")
	ServerHistory.ServerHistoryView getServerHistory(@RequestParam(defaultValue = "7") @Min(1) @Max(90) int days) {
		return serverHistory.view(days);
	}

	@Operation(summary = "Versions and health: backend, Spring Boot, Java, database, photo storage, uptime, errors of the day")
	@GetMapping("/health")
	SiteHealth getSiteHealth() {
		return siteHealthService.check();
	}

}
