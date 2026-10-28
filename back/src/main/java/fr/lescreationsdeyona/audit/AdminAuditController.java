package fr.lescreationsdeyona.audit;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - History")
@RestController
@RequestMapping("/api/admin/history")
@RequiredArgsConstructor
class AdminAuditController {

	private final AuditLog auditLog;

	@Operation(summary = "What was done in the back-office, by whom and when, the latest first (6 months)")
	@GetMapping
	PageResponse<AuditEventResponse> listHistory(@RequestParam(required = false) @Nullable AuditKind kind,
			@ParameterObject @PageableDefault(size = 50) Pageable pageable) {
		return auditLog.latest(kind, pageable);
	}

}
