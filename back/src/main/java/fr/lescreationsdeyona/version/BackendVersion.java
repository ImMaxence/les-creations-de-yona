package fr.lescreationsdeyona.version;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.stereotype.Component;

/** Version of the running backend (pom.xml); "dev" when run from an IDE without build-info.properties. */
@Component
class BackendVersion {

	private final String value;

	/** build-info.properties is written by the Maven build: absent when run from an IDE without it. */
	BackendVersion(ObjectProvider<BuildProperties> buildProperties) {
		BuildProperties properties = buildProperties.getIfAvailable();
		this.value = properties != null ? properties.getVersion() : "dev";
	}

	String value() {
		return value;
	}

}
