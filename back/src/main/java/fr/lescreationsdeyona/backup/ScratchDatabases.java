package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.IOException;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Component;

/**
 * Databases where a backup is restored before anything touches the site's own: each one belongs to
 * a role created for it, without any administration right. The SQL of a dump comes from a file
 * the admin sends: run by such a role, it cannot reach the server (no {@code COPY ... PROGRAM}, no
 * file access, no untrusted language), nor the site's database. Everything read from it is read
 * as that role too.
 */
@Component
class ScratchDatabases {

	private static final Logger log = LoggerFactory.getLogger(ScratchDatabases.class);

	/** Names of the databases and roles created here; anything left by a crash is dropped. */
	private static final String NAME_PREFIX = "yona_restore_";

	private static final Pattern JDBC_URL = Pattern.compile("^jdbc:postgresql://([^/?]+)/([^?]+)(\\?.*)?$");

	private static final long PG_RESTORE_TIMEOUT_MINUTES = 30;

	private static final SecureRandom RANDOM = new SecureRandom();

	private final DataSource dataSource;

	private final DataSourceProperties dataSourceProperties;

	private final String pgRestore;

	ScratchDatabases(DataSource dataSource, DataSourceProperties dataSourceProperties, BackupProperties properties) {
		this.dataSource = dataSource;
		this.dataSourceProperties = dataSourceProperties;
		// Installed next to pg_dump by the PostgreSQL client package.
		Path pgDump = Path.of(properties.pgDump());
		this.pgRestore = pgDump.getParent() == null ? "pg_restore" : pgDump.resolveSibling("pg_restore").toString();
	}

	/** A database and its role; {@code password} is random and only lives in memory. */
	record Scratch(String name, String password, String jdbcUrl, String libpqUrl) {

		/** As the scratch role. One connection, closed by the caller. */
		SingleConnectionDataSource open() {
			SingleConnectionDataSource source = new SingleConnectionDataSource(jdbcUrl, name, password, true);
			source.setAutoCommit(true);
			return source;
		}

	}

	Scratch create() {
		String name = NAME_PREFIX + HexFormat.of().formatHex(randomBytes(6));
		String password = HexFormat.of().formatHex(randomBytes(24));
		// Names and password are made of [a-z0-9_] only: safe to write into the statements.
		execute("create role " + name + " login nosuperuser nocreatedb nocreaterole noinherit password '" + password + "'",
				"create database " + name + " owner " + name + " template template0");
		Matcher url = JDBC_URL.matcher(dataSourceProperties.getUrl());
		if (!url.matches()) {
			drop(name);
			throw new IllegalStateException("Unexpected datasource URL");
		}
		String query = url.group(3) == null ? "" : url.group(3);
		return new Scratch(name, password, "jdbc:postgresql://" + url.group(1) + "/" + name + query,
				"postgresql://" + url.group(1) + "/" + name);
	}

	/** All or nothing: a failure leaves the scratch database empty. */
	void restore(Scratch scratch, Path dump) {
		ProcessBuilder builder = new ProcessBuilder(List.of(pgRestore, "--no-owner", "--no-privileges",
				"--single-transaction", "--exit-on-error", "--no-password", "--dbname=" + scratch.libpqUrl(),
				dump.toString()))
			.redirectErrorStream(true)
			.redirectOutput(ProcessBuilder.Redirect.DISCARD);
		Map<String, String> environment = builder.environment();
		environment.put("PGUSER", scratch.name());
		environment.put("PGPASSWORD", scratch.password());
		Process process;
		try {
			process = builder.start();
		}
		catch (IOException ex) {
			log.error("Cannot start {}: install the PostgreSQL 18 client or set PG_DUMP_PATH", pgRestore, ex);
			throw new ApiException(ErrorCode.RESTORE_UNAVAILABLE, ex);
		}
		try {
			if (!process.waitFor(PG_RESTORE_TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
				process.destroyForcibly();
				throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
			}
		}
		catch (InterruptedException ex) {
			process.destroyForcibly();
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Interrupted during pg_restore", ex);
		}
		if (process.exitValue() != 0) {
			log.warn("pg_restore of a backup failed with exit code {}", process.exitValue());
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
	}

	/**
	 * Brings an older backup to the site's schema with the site's own migrations. A backup from a
	 * newer version (migrations unknown here) is refused.
	 */
	void migrate(Scratch scratch) {
		Flyway flyway = Flyway.configure()
			.dataSource(scratch.jdbcUrl(), scratch.name(), scratch.password())
			.locations("classpath:db/migration")
			.load();
		for (MigrationInfo migration : flyway.info().all()) {
			if (migration.getState().name().startsWith("FUTURE")) {
				throw new ApiException(ErrorCode.RESTORE_NEWER_VERSION);
			}
		}
		try {
			flyway.migrate();
		}
		catch (RuntimeException ex) {
			log.warn("Migration of a restored backup failed", ex);
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID, ex);
		}
	}

	/**
	 * Same tables and columns as the site's database, and nothing that could run code when read:
	 * no view, function (but the unaccent extension's), trigger or rule.
	 */
	void checkSchema(Scratch scratch, JdbcClient scratchJdbc) {
		String columns = """
				select c.table_name || '.' || c.column_name || ':' || c.data_type from information_schema.columns c
				join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
				where c.table_schema = 'public' and t.table_type = 'BASE TABLE' order by 1""";
		String relations = "select table_name || ':' || table_type from information_schema.tables where table_schema = 'public' order by 1";
		JdbcClient site = JdbcClient.create(dataSource);
		boolean sameShape = site.sql(columns).query(String.class).list().equals(scratchJdbc.sql(columns).query(String.class).list())
				&& site.sql(relations).query(String.class).list().equals(scratchJdbc.sql(relations).query(String.class).list());
		long code = scratchJdbc.sql("""
				select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
						where n.nspname = 'public'
						and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
					+ (select count(*) from pg_trigger where not tgisinternal)
					+ (select count(*) from pg_rewrite r join pg_class c on c.oid = r.ev_class
						join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public')""")
			.query(Long.class)
			.single();
		if (!sameShape || code > 0) {
			log.warn("Restored backup rejected: unexpected schema (same tables: {}, code objects: {})", sameShape, code);
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
	}

	void drop(String name) {
		if (!name.matches(NAME_PREFIX + "[0-9a-f]+")) {
			throw new IllegalArgumentException("Not a scratch database: " + name);
		}
		try {
			execute("drop database if exists " + name + " with (force)", "drop role if exists " + name);
		}
		catch (RuntimeException ex) {
			log.warn("Scratch database {} could not be dropped; it will be retried", name, ex);
		}
	}

	/** Left by a crash or a restart during a restore. */
	void dropLeftovers(String keptName) {
		List<String> names = JdbcClient.create(dataSource)
			.sql("""
					select datname from pg_database where starts_with(datname, :prefix)
					union select rolname from pg_roles where starts_with(rolname, :prefix)""")
			.param("prefix", NAME_PREFIX)
			.query(String.class)
			.list();
		names.stream().filter(name -> !name.equals(keptName)).forEach(this::drop);
	}

	/** CREATE and DROP DATABASE cannot run in a transaction: autocommit, on a connection of their own. */
	private void execute(String... statements) {
		try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
			boolean autoCommit = connection.getAutoCommit();
			connection.setAutoCommit(true);
			try {
				for (String sql : statements) {
					statement.execute(sql);
				}
			}
			finally {
				connection.setAutoCommit(autoCommit);
			}
		}
		catch (SQLException ex) {
			throw new IllegalStateException("Scratch database statement failed", ex);
		}
	}

	private static byte[] randomBytes(int count) {
		byte[] bytes = new byte[count];
		RANDOM.nextBytes(bytes);
		return bytes;
	}

}
