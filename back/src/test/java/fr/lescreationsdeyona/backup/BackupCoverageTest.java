package fr.lescreationsdeyona.backup;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Nothing a backup holds is forgotten: every table the migrations leave is either merged by "Fusionner",
 * kept out of a merge on purpose, or tied to this server only (saved empty). A new table fails this test
 * until it is placed in one of them.
 */
class BackupCoverageTest {

	private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

	private static final Pattern CREATE = Pattern.compile("CREATE TABLE (?:IF NOT EXISTS )?(\\w+)", Pattern.CASE_INSENSITIVE);

	private static final Pattern RENAME = Pattern.compile("ALTER TABLE (\\w+) RENAME TO (\\w+)", Pattern.CASE_INSENSITIVE);

	private static final Pattern DROP = Pattern.compile("DROP TABLE (?:IF EXISTS )?(\\w+)", Pattern.CASE_INSENSITIVE);

	/** The tables the migrations leave, read in order: created, renamed, dropped. */
	static Set<String> tables() throws IOException {
		Set<String> tables = new HashSet<>();
		List<Path> files;
		try (Stream<Path> listed = Files.list(MIGRATIONS)) {
			files = listed.filter(path -> path.toString().endsWith(".sql"))
				.sorted((first, second) -> Integer.compare(version(first), version(second)))
				.toList();
		}
		for (Path file : files) {
			String sql = Files.readString(file).replaceAll("--[^\\n]*", "");
			for (String statement : sql.split(";")) {
				Matcher create = CREATE.matcher(statement);
				if (create.find()) {
					tables.add(create.group(1).toLowerCase(Locale.ROOT));
				}
				Matcher rename = RENAME.matcher(statement);
				if (rename.find()) {
					tables.remove(rename.group(1).toLowerCase(Locale.ROOT));
					tables.add(rename.group(2).toLowerCase(Locale.ROOT));
				}
				Matcher drop = DROP.matcher(statement);
				if (drop.find()) {
					tables.remove(drop.group(1).toLowerCase(Locale.ROOT));
				}
			}
		}
		return tables;
	}

	private static int version(Path file) {
		return Integer.parseInt(file.getFileName().toString().replaceFirst("^V(\\d+)__.*", "$1"));
	}

	@Test
	void readsTheTablesOfTheMigrations() throws IOException {
		Set<String> tables = tables();

		assertThat(tables).contains("recipe", "cap_entry", "invoice", "invoice_line", "account_purchase_line", "trash_item")
			.doesNotContain("observation", "recipe_trash");
	}

	@Test
	void placesEveryTableOfTheSite() throws IOException {
		Set<String> placed = new HashSet<>(RestoredData.MERGED_TABLES);
		placed.addAll(RestoredData.NOT_MERGED);
		placed.addAll(BackupService.SITE_ONLY_TABLES);

		assertThat(placed).containsAll(tables());
	}

	@Test
	void namesOnlyTablesThatExist() throws IOException {
		Set<String> tables = tables();

		assertThat(tables).containsAll(RestoredData.MERGED_TABLES)
			.containsAll(RestoredData.NOT_MERGED)
			.containsAll(BackupService.SITE_ONLY_TABLES);
	}

	@Test
	void placesEachTableOnce() {
		Set<String> merged = new HashSet<>(RestoredData.MERGED_TABLES);
		Set<String> siteOnly = new HashSet<>(BackupService.SITE_ONLY_TABLES);

		assertThat(merged).doesNotContainAnyElementsOf(RestoredData.NOT_MERGED).doesNotContainAnyElementsOf(siteOnly);
		assertThat(siteOnly).doesNotContainAnyElementsOf(RestoredData.NOT_MERGED);
	}

}
