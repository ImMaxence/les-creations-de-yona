package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** "Versions et santé", in Statistiques: what runs, whether its parts answer, and the errors of the day. */
public record SiteHealth(
		@Schema(description = "pom.xml; \"dev\" from an IDE") String backendVersion,
		@Schema(description = "\"4.1.2\"") @Nullable String springBootVersion,
		@Schema(description = "\"25.0.4+8-LTS\"") String javaVersion,
		boolean databaseOk,
		@Schema(description = "\"PostgreSQL 18.1\"; absent when the database does not answer") @Nullable String databaseVersion,
		@Schema(description = "The photo bucket answers") boolean storageOk,
		Instant startedAt,
		@Schema(description = "Since the backend started, in seconds") long uptimeSeconds,
		long errorsLast24Hours,
		long warningsLast24Hours,
		@Nullable Instant lastErrorAt) {
}
