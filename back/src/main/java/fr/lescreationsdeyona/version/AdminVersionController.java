package fr.lescreationsdeyona.version;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Version")
@RestController
@RequestMapping("/api/admin/version")
class AdminVersionController {

	private final String version;

	/** build-info.properties is written by the Maven build: absent when run from an IDE without it. */
	AdminVersionController(ObjectProvider<BuildProperties> buildProperties) {
		BuildProperties properties = buildProperties.getIfAvailable();
		this.version = properties != null ? properties.getVersion() : "dev";
	}

	@Operation(summary = "Version of the running backend")
	@GetMapping
	VersionResponse getVersion() {
		return new VersionResponse(version);
	}

}