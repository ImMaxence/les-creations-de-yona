package fr.lescreationsdeyona.stats;

import fr.lescreationsdeyona.image.ImageStorage;
import fr.lescreationsdeyona.monitoring.ErrorLog;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringBootVersion;
import org.springframework.boot.info.BuildProperties;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** What "Versions et santé" shows: asked one by one, a part that does not answer does not hide the others. */
@Service
class SiteHealthService {

	private final JdbcClient jdbc;

	private final ImageStorage imageStorage;

	private final ErrorLog errorLog;

	private final String backendVersion;

	SiteHealthService(JdbcClient jdbc, ImageStorage imageStorage, ErrorLog errorLog, ObjectProvider<BuildProperties> buildProperties) {
		this.jdbc = jdbc;
		this.imageStorage = imageStorage;
		this.errorLog = errorLog;
		BuildProperties properties = buildProperties.getIfAvailable();
		this.backendVersion = properties != null ? properties.getVersion() : "dev";
	}

	SiteHealth check() {
		String database = databaseVersion();
		ErrorLog.ErrorLogSummary errors = database == null ? null : errorLog.summary();
		long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
		return new SiteHealth(backendVersion, SpringBootVersion.getVersion(), Runtime.version().toString(), database != null,
				database, imageStorage.reachable(), Instant.now().minusMillis(uptime), uptime / 1000,
				errors == null ? 0 : errors.errorsLast24Hours(), errors == null ? 0 : errors.warningsLast24Hours(),
				errors == null ? null : errors.lastErrorAt());
	}

	/** "PostgreSQL 18.1"; null when it does not answer. */
	private @Nullable String databaseVersion() {
		try {
			String version = jdbc.sql("show server_version").query(String.class).single();
			// "18.1 (Debian 18.1-1.pgdg13+2)": the number alone
			return "PostgreSQL " + version.split(" ")[0];
		}
		catch (RuntimeException ex) {
			return null;
		}
	}

}
