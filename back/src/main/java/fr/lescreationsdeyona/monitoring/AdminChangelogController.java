package fr.lescreationsdeyona.monitoring;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Changelog")
@RestController
@RequestMapping("/api/admin/changelog")
class AdminChangelogController {

	/** The version of the changelog the admin read last. */
	record ChangelogSeen(@Schema(description = "\"2.7.0\"; absent before the first visit") @Nullable String version) {
	}

	record ChangelogRead(@NotBlank @Size(max = 30) String version) {
	}

	private final AdminSeen adminSeen;

	AdminChangelogController(AdminSeen adminSeen) {
		this.adminSeen = adminSeen;
	}

	@Operation(summary = "The version of \"Nouveautés\" this admin read last: a newer one puts a badge on it")
	@GetMapping("/seen")
	ChangelogSeen getChangelogSeen() {
		return new ChangelogSeen(adminSeen.of(AdminSeen.Topic.CHANGELOG).map(AdminSeen.Mark::version).orElse(null));
	}

	@Operation(summary = "\"Nouveautés\" read up to this version: its badge goes")
	@PutMapping("/seen")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markChangelogSeen(@Valid @RequestBody ChangelogRead read) {
		adminSeen.mark(AdminSeen.Topic.CHANGELOG, read.version());
	}

}
