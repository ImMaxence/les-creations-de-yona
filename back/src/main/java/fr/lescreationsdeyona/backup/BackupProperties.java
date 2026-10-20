package fr.lescreationsdeyona.backup;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param pgDump the PostgreSQL client, same major version as the server (18): the backend Docker
 * image ships it; for a local run, {@code PG_DUMP_PATH} can point to an installed one.
 */
@Validated
@ConfigurationProperties("app.backup")
public record BackupProperties(@NotBlank String pgDump) {
}
