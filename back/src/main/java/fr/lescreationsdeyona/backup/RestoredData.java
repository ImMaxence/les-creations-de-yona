package fr.lescreationsdeyona.backup;

import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.theme.BodyFont;
import fr.lescreationsdeyona.theme.DisplayFont;
import fr.lescreationsdeyona.theme.ThemePreset;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Compares a restored backup (scratch database, already at the site's schema) with the site's
 * database, and brings its data in: either only what the site lacks ("Fusionner"), or all of it in
 * place of the site's ("Tout remplacer"). Each runs in one transaction on the site's database.
 * <p>
 * Things are matched by what identifies them for the admin: a recipe, a category or a tag by its
 * slug (its URL), an ingredient, a tag or a saved look by its name (case and accents ignored), a
 * social link by its platform, an image by its id, a glossary word by its name. Ids of rows created
 * here are new. The trash is not merged: a recipe deleted on the site stays deleted.
 */
@Component
@RequiredArgsConstructor
class RestoredData {

	private static final int LISTED_NAMES = 50;

	private final DataSource dataSource;

	private final TransactionTemplate transactions;

	/**
	 * Values the site's database does not check itself: the saved looks hold enum names without a
	 * CHECK constraint (see the V7 migration). Every other column is checked by the site's own
	 * constraints when the rows are written, which rolls the whole restore back.
	 */
	void checkValues(JdbcClient scratch) {
		long invalid = scratch.sql("""
				select count(*) from appearance_preset
				where preset not in (:presets) or display_font not in (:displayFonts) or body_font not in (:bodyFonts)""")
			.param("presets", names(ThemePreset.values()))
			.param("displayFonts", names(DisplayFont.values()))
			.param("bodyFonts", names(BodyFont.values()))
			.query(Long.class)
			.single();
		if (invalid > 0) {
			throw new ApiException(ErrorCode.RESTORE_ARCHIVE_INVALID);
		}
	}

	/** Expanded by the named parameters into (?, ?, …). */
	private static List<String> names(Enum<?>[] values) {
		return Arrays.stream(values).map(Enum::name).toList();
	}

	RestoreStatus.Counts counts(JdbcClient db) {
		return new RestoreStatus.Counts(count(db, "recipe"), count(db, "category"), count(db, "tag"),
				count(db, "ingredient"), count(db, "image"), count(db, "social_link"), count(db, "appearance_preset"),
				count(db, "glossary_term"));
	}

	RestoreStatus.Missing missing(JdbcClient scratch) {
		JdbcClient site = JdbcClient.create(dataSource);
		Set<String> siteRecipes = strings(site, "select slug from recipe");
		List<String> recipes = scratch.sql("select title, slug from recipe order by title").query().listOfRows()
			.stream().filter(row -> !siteRecipes.contains((String) row.get("slug"))).map(row -> (String) row.get("title")).toList();
		Set<String> siteCategories = strings(site, "select slug from category");
		List<String> categories = scratch.sql("select name, slug from category order by name").query().listOfRows()
			.stream().filter(row -> !siteCategories.contains((String) row.get("slug"))).map(row -> (String) row.get("name")).toList();
		Set<String> siteTagSlugs = strings(site, "select slug from tag");
		Set<String> siteTagNames = folded(strings(site, "select name from tag"));
		List<String> tags = scratch.sql("select name, slug from tag order by name").query().listOfRows()
			.stream()
			.filter(row -> !siteTagSlugs.contains((String) row.get("slug"))
					&& !siteTagNames.contains(Texts.foldCaseAndAccents((String) row.get("name"))))
			.map(row -> (String) row.get("name"))
			.toList();
		Set<String> siteIngredients = folded(strings(site, "select name from ingredient"));
		long ingredients = strings(scratch, "select name from ingredient").stream()
			.filter(name -> !siteIngredients.contains(Texts.foldCaseAndAccents(name)))
			.count();
		Set<UUID> siteImages = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		long images = scratch.sql("select id from image").query(UUID.class).list().stream().filter(id -> !siteImages.contains(id)).count();
		Set<String> sitePlatforms = strings(site, "select platform from social_link");
		List<String> platforms = scratch.sql("select platform from social_link order by position").query(String.class).list()
			.stream().filter(platform -> !sitePlatforms.contains(platform)).toList();
		Set<String> sitePresets = folded(strings(site, "select name from appearance_preset"));
		List<String> presets = scratch.sql("select name from appearance_preset order by name").query(String.class).list()
			.stream().filter(name -> !sitePresets.contains(Texts.foldCaseAndAccents(name))).toList();
		Set<String> siteTerms = folded(strings(site, "select name from glossary_term"));
		List<String> terms = scratch.sql("select name from glossary_term order by name").query(String.class).list()
			.stream().filter(name -> !siteTerms.contains(Texts.foldCaseAndAccents(name))).toList();
		return new RestoreStatus.Missing(recipes.size(), first(recipes), categories.size(), first(categories), tags.size(),
				first(tags), ingredients, images, platforms.size(), platforms, presets.size(), first(presets), terms.size(),
				first(terms));
	}

	/**
	 * Adds what the site lacks, without changing nor removing anything. An image is added only if
	 * its two files are in storage ({@code storedKeys}, after the upload of the archive's files).
	 * Added recipes are never featured when the site already has a featured recipe.
	 */
	RestoreStatus.Counts merge(JdbcClient scratch, Set<String> storedKeys) {
		return transactions.execute(status -> {
			JdbcClient site = JdbcClient.create(dataSource);
			Added added = new Added();
			added.images = mergeImages(scratch, site, storedKeys);
			Map<Long, Long> categories = mergeCategories(scratch, site, added);
			Map<Long, Long> tags = mergeTags(scratch, site, added);
			Map<Long, Long> ingredients = mergeIngredients(scratch, site, added);
			added.recipes = mergeRecipes(scratch, site, categories, tags, ingredients);
			added.socialLinks = mergeSocialLinks(scratch, site);
			added.presets = mergePresets(scratch, site);
			long glossaryTerms = mergeGlossary(scratch, site);
			return new RestoreStatus.Counts(added.recipes, added.categories, added.tags, added.ingredients,
					added.images, added.socialLinks, added.presets, glossaryTerms);
		});
	}

	/** Rows created by a merge, by kind. */
	private static final class Added {

		long images;

		long categories;

		long tags;

		long ingredients;

		long recipes;

		long socialLinks;

		long presets;

	}

	private long mergeImages(JdbcClient scratch, JdbcClient site, Set<String> storedKeys) {
		Set<UUID> existing = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		long added = 0;
		for (Map<String, Object> row : scratch.sql("select id, kind, s3_prefix, created_at from image").query().listOfRows()) {
			String prefix = (String) row.get("s3_prefix");
			if (existing.contains((UUID) row.get("id"))
					|| !(storedKeys.contains(prefix + "800.webp") && storedKeys.contains(prefix + "1600.webp"))) {
				continue;
			}
			site.sql("insert into image (id, kind, s3_prefix, created_at) values (:id, :kind, :s3_prefix, :created_at)")
				.params(row)
				.update();
			added++;
		}
		return added;
	}

	/** Backup id to site id, for every category of the backup. */
	private Map<Long, Long> mergeCategories(JdbcClient scratch, JdbcClient site, Added added) {
		Map<String, Long> bySlug = idsBy(site, "select id, slug as key from category");
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		Map<Long, Long> ids = new HashMap<>();
		for (Map<String, Object> row : scratch.sql("select id, name, slug, image_id from category").query().listOfRows()) {
			Long siteId = bySlug.get((String) row.get("slug"));
			if (siteId == null) {
				UUID imageId = (UUID) row.get("image_id");
				siteId = site.sql("insert into category (name, slug, image_id) values (:name, :slug, :imageId) returning id")
					.param("name", row.get("name"))
					.param("slug", row.get("slug"))
					.param("imageId", imageId != null && images.contains(imageId) ? imageId : null)
					.query(Long.class)
					.single();
				added.categories++;
			}
			ids.put(((Number) row.get("id")).longValue(), siteId);
		}
		return ids;
	}

	private Map<Long, Long> mergeTags(JdbcClient scratch, JdbcClient site, Added added) {
		Map<String, Long> bySlug = idsBy(site, "select id, slug as key from tag");
		Map<String, Long> byName = foldedKeys(idsBy(site, "select id, name as key from tag"));
		Map<Long, Long> ids = new HashMap<>();
		for (Map<String, Object> row : scratch.sql("select id, name, slug from tag").query().listOfRows()) {
			String name = (String) row.get("name");
			Long siteId = bySlug.getOrDefault((String) row.get("slug"), byName.get(Texts.foldCaseAndAccents(name)));
			if (siteId == null) {
				siteId = site.sql("insert into tag (name, slug) values (:name, :slug) returning id")
					.param("name", name)
					.param("slug", row.get("slug"))
					.query(Long.class)
					.single();
				added.tags++;
			}
			ids.put(((Number) row.get("id")).longValue(), siteId);
		}
		return ids;
	}

	private Map<Long, Long> mergeIngredients(JdbcClient scratch, JdbcClient site, Added added) {
		Map<Long, Long> ids = new HashMap<>();
		for (Map<String, Object> row : scratch.sql("select id, name, aisle from ingredient").query().listOfRows()) {
			// An ingredient already on the site keeps its aisle; one added comes with the backup's
			added.ingredients += site.sql("insert into ingredient (name, aisle) values (:name, :aisle) on conflict (name) do nothing")
				.param("name", row.get("name"))
				.param("aisle", row.get("aisle"))
				.update();
			// The column collation ignores case and accents: finds the site's spelling too.
			Long siteId = site.sql("select id from ingredient where name = :name").param("name", row.get("name"))
				.query(Long.class)
				.single();
			ids.put(((Number) row.get("id")).longValue(), siteId);
		}
		return ids;
	}

	private long mergeRecipes(JdbcClient scratch, JdbcClient site, Map<Long, Long> categories, Map<Long, Long> tags,
			Map<Long, Long> ingredients) {
		Set<String> existing = strings(site, "select slug from recipe");
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		boolean featuredTaken = site.sql("select exists (select 1 from recipe where featured)").query(Boolean.class).single();
		long added = 0;
		for (Map<String, Object> recipe : scratch.sql("select * from recipe order by id").query().listOfRows()) {
			if (existing.contains((String) recipe.get("slug"))) {
				continue;
			}
			Map<String, Object> values = new LinkedHashMap<>(recipe);
			long backupId = ((Number) values.remove("id")).longValue();
			values.computeIfPresent("image_id", (key, id) -> images.contains(id) ? id : null);
			values.computeIfPresent("pinterest_image_id", (key, id) -> images.contains(id) ? id : null);
			boolean featured = Boolean.TRUE.equals(values.get("featured")) && !featuredTaken;
			featuredTaken |= featured;
			values.put("featured", featured);
			// A publication scheduled in the backup is never done by surprise: the admin schedules it again
			values.put("scheduled_at", null);
			long siteId = insertReturningId(site, "recipe", values);
			for (Map<String, Object> link : scratch.sql("select category_id, position from recipe_category where recipe_id = :id")
				.param("id", backupId).query().listOfRows()) {
				site.sql("insert into recipe_category (recipe_id, category_id, position) values (:recipe, :category, :position)")
					.param("recipe", siteId)
					.param("category", categories.get(((Number) link.get("category_id")).longValue()))
					.param("position", link.get("position"))
					.update();
			}
			for (Long tagId : scratch.sql("select tag_id from recipe_tag where recipe_id = :id").param("id", backupId)
				.query(Long.class).list()) {
				site.sql("insert into recipe_tag (recipe_id, tag_id) values (:recipe, :tag) on conflict do nothing")
					.param("recipe", siteId)
					.param("tag", tags.get(tagId))
					.update();
			}
			for (Map<String, Object> part : scratch.sql("select id, position, title from recipe_part where recipe_id = :id")
				.param("id", backupId).query().listOfRows()) {
				long partId = site.sql("insert into recipe_part (recipe_id, position, title) values (:recipe, :position, :title) returning id")
					.param("recipe", siteId)
					.param("position", part.get("position"))
					.param("title", part.get("title"))
					.query(Long.class)
					.single();
				long backupPartId = ((Number) part.get("id")).longValue();
				for (Map<String, Object> line : scratch.sql("""
						select ingredient_id, quantity, unit, note, position from recipe_ingredient where part_id = :part""")
					.param("part", backupPartId).query().listOfRows()) {
					site.sql("""
							insert into recipe_ingredient (part_id, ingredient_id, quantity, unit, note, position)
							values (:part, :ingredient, :quantity, :unit, :note, :position)""")
						.param("part", partId)
						.param("ingredient", ingredients.get(((Number) line.get("ingredient_id")).longValue()))
						.param("quantity", line.get("quantity"))
						.param("unit", line.get("unit"))
						.param("note", line.get("note"))
						.param("position", line.get("position"))
						.update();
				}
				// Positions in the part's ingredient list: the same in the backup and on the site
				for (Map<String, Object> step : scratch.sql("""
						select position, description, duration_minutes, ingredient_positions::text as ingredient_positions
						from recipe_step where part_id = :part""")
					.param("part", backupPartId).query().listOfRows()) {
					site.sql("""
							insert into recipe_step (part_id, position, description, duration_minutes, ingredient_positions)
							values (:part, :position, :description, :duration_minutes, cast(:ingredient_positions as integer[]))""")
						.param("part", partId)
						.params(step)
						.update();
				}
			}
			added++;
		}
		return added;
	}

	private long mergeSocialLinks(JdbcClient scratch, JdbcClient site) {
		Set<String> existing = strings(site, "select platform from social_link");
		long added = 0;
		for (Map<String, Object> row : scratch.sql("select platform, url from social_link order by position").query().listOfRows()) {
			if (existing.contains((String) row.get("platform"))) {
				continue;
			}
			site.sql("""
					insert into social_link (platform, url, position)
					values (:platform, :url, (select coalesce(max(position) + 1, 0) from social_link))""")
				.params(row)
				.update();
			added++;
		}
		return added;
	}

	private long mergePresets(JdbcClient scratch, JdbcClient site) {
		long added = 0;
		for (Map<String, Object> row : scratch.sql("""
				select name, preset, display_font, body_font, radius_px, created_at, updated_at, updated_by
				from appearance_preset""").query().listOfRows()) {
			added += site.sql("""
					insert into appearance_preset (name, preset, display_font, body_font, radius_px, created_at, updated_at, updated_by)
					values (:name, :preset, :display_font, :body_font, :radius_px, :created_at, :updated_at, :updated_by)
					on conflict (name) do nothing""")
				.params(row)
				.update();
		}
		return added;
	}

	/** A word whose name or anchor the site already has is left out. */
	private long mergeGlossary(JdbcClient scratch, JdbcClient site) {
		long added = 0;
		for (Map<String, Object> row : scratch.sql("""
				select name, slug, definition, forms::text as forms, updated_at, updated_by from glossary_term""")
			.query().listOfRows()) {
			added += site.sql("""
					insert into glossary_term (name, slug, definition, forms, updated_at, updated_by)
					values (:name, :slug, :definition, cast(:forms as text[]), :updated_at, :updated_by)
					on conflict do nothing""")
				.params(row)
				.update();
		}
		return added;
	}

	/**
	 * Every table of the site (but Flyway's history and the tables tied to this server, saved empty)
	 * emptied, then filled with the backup's rows, parents before children; identity sequences then
	 * continue after the restored ids.
	 */
	RestoreStatus.Counts replace(DataSource scratch) {
		return transactions.execute(status -> {
			JdbcClient site = JdbcClient.create(dataSource);
			List<String> tables = tablesParentsFirst(site);
			site.sql("truncate " + tables.stream().map(RestoredData::quoted).collect(Collectors.joining(", "))
					+ " restart identity").update();
			Connection siteConnection = DataSourceUtils.getConnection(dataSource);
			try (Connection scratchConnection = scratch.getConnection()) {
				CopyManager from = scratchConnection.unwrap(PGConnection.class).getCopyAPI();
				CopyManager to = siteConnection.unwrap(PGConnection.class).getCopyAPI();
				for (String table : tables) {
					String columns = site.sql("""
							select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
							from information_schema.columns where table_schema = 'public' and table_name = :table""")
						.param("table", table)
						.query(String.class)
						.single();
					ByteArrayOutputStream rows = new ByteArrayOutputStream();
					from.copyOut("copy (select " + columns + " from " + quoted(table) + ") to stdout (format binary)", rows);
					to.copyIn("copy " + quoted(table) + " (" + columns + ") from stdin (format binary)",
							new ByteArrayInputStream(rows.toByteArray()));
				}
			}
			catch (SQLException | IOException ex) {
				throw new IllegalStateException("Copy of the restored backup failed", ex);
			}
			finally {
				DataSourceUtils.releaseConnection(siteConnection, dataSource);
			}
			// A publication scheduled in the past would happen within a minute, notification included
			site.sql("update recipe set scheduled_at = null where scheduled_at < now()").update();
			for (Map<String, Object> identity : site.sql("""
					select table_name, column_name from information_schema.columns
					where table_schema = 'public' and is_identity = 'YES'""").query().listOfRows()) {
				String table = quoted((String) identity.get("table_name"));
				String column = quoted((String) identity.get("column_name"));
				site.sql("select setval(pg_get_serial_sequence(:table, :column), coalesce((select max(" + column + ") from "
						+ table + "), 0) + 1, false)")
					.param("table", "public." + table)
					.param("column", identity.get("column_name"))
					.query()
					.listOfRows();
			}
			return counts(site);
		});
	}

	/** Topological order of the foreign keys: a table comes after the tables it points to. */
	private static List<String> tablesParentsFirst(JdbcClient site) {
		List<String> tables = site.sql("""
				select table_name from information_schema.tables
				where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'flyway_schema_history'
				order by table_name""").query(String.class).list()
			.stream()
			.filter(table -> !BackupService.SITE_ONLY_TABLES.contains(table))
			.toList();
		Map<String, Set<String>> parents = new HashMap<>();
		for (Map<String, Object> key : site.sql("""
				select child.relname as child, parent.relname as parent from pg_constraint c
				join pg_class child on child.oid = c.conrelid join pg_class parent on parent.oid = c.confrelid
				where c.contype = 'f' and c.connamespace = 'public'::regnamespace""").query().listOfRows()) {
			parents.computeIfAbsent((String) key.get("child"), table -> new HashSet<>()).add((String) key.get("parent"));
		}
		List<String> ordered = new ArrayList<>();
		while (ordered.size() < tables.size()) {
			int before = ordered.size();
			for (String table : tables) {
				if (!ordered.contains(table) && ordered.containsAll(parents.getOrDefault(table, Set.of()).stream()
					.filter(parent -> !parent.equals(table)).toList())) {
					ordered.add(table);
				}
			}
			if (ordered.size() == before) {
				throw new IllegalStateException("Cycle in the foreign keys of " + tables);
			}
		}
		return ordered;
	}

	private static long insertReturningId(JdbcClient site, String table, Map<String, Object> values) {
		String columns = values.keySet().stream().map(RestoredData::quoted).collect(Collectors.joining(", "));
		String parameters = values.keySet().stream().map(column -> ":" + column).collect(Collectors.joining(", "));
		return site.sql("insert into " + table + " (" + columns + ") values (" + parameters + ") returning id")
			.params(values)
			.query(Long.class)
			.single();
	}

	private static long count(JdbcClient db, String table) {
		return db.sql("select count(*) from " + table).query(Long.class).single();
	}

	private static Set<String> strings(JdbcClient db, String sql) {
		return new HashSet<>(db.sql(sql).query(String.class).list());
	}

	private static Set<String> folded(Collection<String> names) {
		return names.stream().map(Texts::foldCaseAndAccents).collect(Collectors.toSet());
	}

	private static Map<String, Long> idsBy(JdbcClient db, String sql) {
		return db.sql(sql).query().listOfRows().stream()
			.collect(Collectors.toMap(row -> (String) row.get("key"), row -> ((Number) row.get("id")).longValue(),
					(first, second) -> first));
	}

	private static Map<String, Long> foldedKeys(Map<String, Long> ids) {
		return ids.entrySet().stream()
			.collect(Collectors.toMap(entry -> Texts.foldCaseAndAccents(entry.getKey()), Map.Entry::getValue,
					(first, second) -> first));
	}

	private static List<String> first(List<String> names) {
		return names.size() <= LISTED_NAMES ? names : names.subList(0, LISTED_NAMES);
	}

	/** Names read from the catalog, written as SQL identifiers. */
	private static String quoted(String identifier) {
		return "\"" + identifier.replace("\"", "\"\"") + "\"";
	}

}
