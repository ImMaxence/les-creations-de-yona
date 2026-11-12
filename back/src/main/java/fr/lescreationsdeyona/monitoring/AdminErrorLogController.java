package fr.lescreationsdeyona.monitoring;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Error log")
@RestController
@RequestMapping("/api/admin/logs")
@Validated
class AdminErrorLogController {

	private final ErrorLog errorLog;

	private final AdminSeen adminSeen;

	AdminErrorLogController(ErrorLog errorLog, AdminSeen adminSeen) {
		this.errorLog = errorLog;
		this.adminSeen = adminSeen;
	}

	@Operation(summary = "Errors and warnings of the backend and of the visitors' browsers, the latest first (30 days)")
	@GetMapping
	PageResponse<ErrorLog.ErrorLogLine> listErrorLog(@RequestParam(required = false) LoggedProblem.@Nullable Level level,
			@RequestParam(required = false) LoggedProblem.@Nullable Source source, @RequestParam(defaultValue = "false") boolean archived,
			@RequestParam(defaultValue = "0") @Min(0) int page, @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size) {
		return errorLog.lines(level, source, archived, page, size);
	}

	@Operation(summary = "The counters of \"Journaux\" and its badge: errors since this admin last opened it")
	@GetMapping("/summary")
	ErrorLog.ErrorLogSummary getErrorLogSummary() {
		return errorLog.summary();
	}

	@Operation(summary = "The error log is seen now: its badge goes")
	@PutMapping("/seen")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markErrorLogSeen() {
		adminSeen.mark(AdminSeen.Topic.LOGS, null);
	}

	@Operation(summary = "Archive lines (the problem handled: out of the list, not erased), or bring them back with archived=false; without ids, all those of the other list",
			description = "A problem archived that happens again comes back to the list on its own, marked as come back.")
	@PutMapping("/archived")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void archiveErrorLog(@RequestParam(required = false) @Nullable List<Long> ids, @RequestParam(defaultValue = "true") boolean archived) {
		errorLog.archive(ids, archived);
	}

	@Operation(summary = "Erase lines of the log (solved, or seen enough); every line without ids")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void eraseErrorLog(@RequestParam(required = false) @Nullable List<Long> ids) {
		errorLog.erase(ids);
	}

}
