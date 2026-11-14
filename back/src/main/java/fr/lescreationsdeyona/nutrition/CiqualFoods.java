package fr.lescreationsdeyona.nutrition;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The foods of the Ciqual table (ciqual_food), and its version (ciqual_table). */
@Repository
@RequiredArgsConstructor
public class CiqualFoods {

	private static final String COLUMNS = "code, name, subgroup_code, subgroup_name, kcal, proteins, carbohydrates, sugars, fat, "
			+ "saturated_fat, fibre, salt";

	private static final int BATCH = 500;

	private final JdbcClient jdbc;

	private final JdbcTemplate jdbcTemplate;

	/** About 3 500 foods, by name: read at each search of the back-office, a few milliseconds. */
	public List<CiqualFood> all() {
		return jdbc.sql("select " + COLUMNS + " from ciqual_food order by name").query(CiqualFoods::row).list()
			.stream()
			.map(CiqualRow::food)
			.toList();
	}

	public Optional<CiqualFood> find(int code) {
		return jdbc.sql("select " + COLUMNS + " from ciqual_food where code = :code")
			.param("code", code)
			.query(CiqualFoods::row)
			.optional()
			.map(CiqualRow::food);
	}

	public Map<Integer, CiqualFood> findAll(Collection<Integer> codes) {
		if (codes.isEmpty()) {
			return Map.of();
		}
		return jdbc.sql("select " + COLUMNS + " from ciqual_food where code in (:codes)")
			.param("codes", Set.copyOf(codes))
			.query(CiqualFoods::row)
			.list()
			.stream()
			.map(CiqualRow::food)
			.collect(Collectors.toMap(CiqualFood::code, Function.identity()));
	}

	/** "Ciqual 2025", shown in the source of the nutrition facts. */
	public CiqualTable table() {
		return jdbc.sql("select version, food_count, imported_at, imported_by from ciqual_table")
			.query((rs, row) -> new CiqualTable(rs.getString("version"), rs.getInt("food_count"),
					rs.getObject("imported_at", OffsetDateTime.class).toInstant(), rs.getString("imported_by")))
			.optional()
			.orElse(new CiqualTable("Ciqual", 0, Instant.EPOCH, "migration"));
	}

	/**
	 * The table of a new version in place of the one before, in the transaction of the caller: foods kept by their
	 * code (the ingredients linked to them stay so), new ones added, those gone deleted, which unlinks their
	 * ingredients (ON DELETE SET NULL): named in the answer, to be linked again.
	 */
	CiqualImport replace(List<CiqualRow> rows, String version, String admin) {
		Set<Integer> before = new HashSet<>(jdbc.sql("select code from ciqual_food").query(Integer.class).list());
		Set<Integer> after = rows.stream().map(CiqualRow::code).collect(Collectors.toSet());
		for (int start = 0; start < rows.size(); start += BATCH) {
			List<CiqualRow> batch = rows.subList(start, Math.min(rows.size(), start + BATCH));
			jdbcTemplate.batchUpdate("""
					insert into ciqual_food (%s) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					on conflict (code) do update set name = excluded.name, subgroup_code = excluded.subgroup_code,
					subgroup_name = excluded.subgroup_name, kcal = excluded.kcal, proteins = excluded.proteins,
					carbohydrates = excluded.carbohydrates, sugars = excluded.sugars, fat = excluded.fat,
					saturated_fat = excluded.saturated_fat, fibre = excluded.fibre, salt = excluded.salt""".formatted(COLUMNS),
					batch, batch.size(), (statement, row) -> {
						statement.setInt(1, row.code());
						statement.setString(2, row.name());
						statement.setString(3, row.subgroupCode());
						statement.setString(4, row.subgroupName());
						decimal(statement, 5, row.kcal());
						decimal(statement, 6, row.proteins());
						decimal(statement, 7, row.carbohydrates());
						decimal(statement, 8, row.sugars());
						decimal(statement, 9, row.fat());
						decimal(statement, 10, row.saturatedFat());
						decimal(statement, 11, row.fibre());
						decimal(statement, 12, row.salt());
					});
		}
		Set<Integer> gone = new HashSet<>(before);
		gone.removeAll(after);
		List<String> unlinked = List.of();
		if (!gone.isEmpty()) {
			unlinked = jdbc.sql("select name from ingredient where ciqual_code in (:codes) order by name")
				.param("codes", gone)
				.query(String.class)
				.list();
			jdbc.sql("delete from ciqual_food where code in (:codes)").param("codes", gone).update();
		}
		jdbc.sql("update ciqual_table set version = :version, food_count = :count, imported_at = now(), imported_by = :admin")
			.param("version", version)
			.param("count", rows.size())
			.param("admin", admin)
			.update();
		int added = (int) after.stream().filter(code -> !before.contains(code)).count();
		return new CiqualImport(version, rows.size(), added, gone.size(), unlinked);
	}

	private static void decimal(PreparedStatement statement, int index, @Nullable BigDecimal value) throws SQLException {
		if (value == null) {
			statement.setNull(index, Types.NUMERIC);
		}
		else {
			statement.setBigDecimal(index, value);
		}
	}

	private static CiqualRow row(ResultSet rs, int rowNumber) throws SQLException {
		return new CiqualRow(rs.getInt("code"), rs.getString("name"), rs.getString("subgroup_code"), rs.getString("subgroup_name"),
				rs.getBigDecimal("kcal"), rs.getBigDecimal("proteins"), rs.getBigDecimal("carbohydrates"), rs.getBigDecimal("sugars"),
				rs.getBigDecimal("fat"), rs.getBigDecimal("saturated_fat"), rs.getBigDecimal("fibre"), rs.getBigDecimal("salt"));
	}

}
