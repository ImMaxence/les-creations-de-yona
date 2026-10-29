package fr.lescreationsdeyona.version;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Version")
@RestController
@RequestMapping("/api/admin/version")
@RequiredArgsConstructor
class AdminVersionController {

	private final BackendVersion version;

	@Operation(summary = "Version of the running backend")
	@GetMapping
	VersionResponse getVersion() {
		return new VersionResponse(version.value());
	}

}
