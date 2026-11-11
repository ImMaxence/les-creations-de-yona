package fr.lescreationsdeyona.audit;

import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.monitoring.Unseen;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - History")
@RestController
@RequestMapping("/api/admin/history")
@RequiredArgsConstructor
class AdminAuditController {

	private final AuditLog auditLog;

	private final AdminSeen adminSeen;

	@Operation(summary = "What was done in the back-office, by whom and when, the latest first (6 months)")
	@GetMapping
	PageResponse<AuditEventResponse> listHistory(@RequestParam(required = false) @Nullable AuditKind kind,
			@ParameterObject @PageableDefault(size = 50) Pageable pageable) {
		return auditLog.latest(kind, pageable);
	}

	@Operation(summary = "What the others did since this admin last opened the history: the badge of \"Historique\"")
	@GetMapping("/unseen")
	Unseen countUnseenHistory() {
		return auditLog.unseen();
	}

	@Operation(summary = "The history is seen now: its badge goes")
	@PutMapping("/seen")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markHistorySeen() {
		adminSeen.mark(AdminSeen.Topic.HISTORY, null);
	}

}
