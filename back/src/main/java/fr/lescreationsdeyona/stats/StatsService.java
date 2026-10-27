package fr.lescreationsdeyona.stats;

import fr.lescreationsdeyona.image.ImageStorage;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.search.SearchMissService;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Aggregates computed by PostgreSQL in a few queries, rather than by loading every row. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatsService {

	private static final Logger log = LoggerFactory.getLogger(StatsService.class);

	private static final int TOP_INGREDIENTS = 8;

	private static final int MOST_VIEWED_RECIPES = 10;

	private static final int INCOMPLETE_RECIPES = 100;

	private static final int DATED_RECIPES = 50;

	private static final int SEARCH_MISSES = 30;

	private final JdbcClient jdbc;

	private final ImageStorage imageStorage;

	private final SearchMissService searchMissService;

	public SiteStats compute() {
		return new SiteStats(recipes(), jdbc.sql("select count(*) from category").query(Long.class).single(),
				ingredients(), images(), recipesPerCategory(), topIngredients(), mostViewedRecipes(), recipesPerMonth(), storage(),
				incompleteRecipes(), datedRecipes("DRAFT", "30 days"), datedRecipes("PUBLISHED", "12 months"),
				searchMissService.top(SEARCH_MISSES), count("push_subscription"), count("trash_item"),
				count("glossary_term"), Instant.now());
	}

	/** {@code table}: a constant of this class, never user input. */
	private long count(String table) {
		return jdbc.sql("select count(*) from " + table).query(Long.class).single();
	}

	/**
	 * What Google shows in its recipe results (photo, description, times, yield) and what visitors
	 * look for on the page (difficulty).
	 */
	private List<SiteStats.IncompleteRecipe> incompleteRecipes() {
		return jdbc.sql("""
				select id, title, status, image_id is null as no_photo, coalesce(trim(intro), '') = '' as no_intro,
					prep_minutes is null and cook_minutes is null as no_time, servings is null as no_servings,
					difficulty is null as no_difficulty
				from recipe
				where image_id is null or coalesce(trim(intro), '') = '' or (prep_minutes is null and cook_minutes is null)
					or servings is null or difficulty is null
				order by status = 'PUBLISHED' desc,
					(image_id is null)::int + (coalesce(trim(intro), '') = '')::int
						+ (prep_minutes is null and cook_minutes is null)::int + (servings is null)::int
						+ (difficulty is null)::int desc,
					title
				limit :limit""")
			.param("limit", INCOMPLETE_RECIPES)
			.query((row, index) -> {
				List<SiteStats.MissingField> missing = new ArrayList<>();
				if (row.getBoolean("no_photo")) {
					missing.add(SiteStats.MissingField.PHOTO);
				}
				if (row.getBoolean("no_intro")) {
					missing.add(SiteStats.MissingField.INTRO);
				}
				if (row.getBoolean("no_time")) {
					missing.add(SiteStats.MissingField.TIME);
				}
				if (row.getBoolean("no_servings")) {
					missing.add(SiteStats.MissingField.SERVINGS);
				}
				if (row.getBoolean("no_difficulty")) {
					missing.add(SiteStats.MissingField.DIFFICULTY);
				}
				return new SiteStats.IncompleteRecipe(row.getLong("id"), row.getString("title"),
						RecipeStatus.valueOf(row.getString("status")), missing);
			})
			.list();
	}

	/** Recipes of this status not changed for {@code age} (a PostgreSQL interval), the oldest first. */
	private List<SiteStats.DatedRecipe> datedRecipes(String status, String age) {
		return jdbc.sql("""
				select id, title, updated_at from recipe
				where status = :status and updated_at < now() - cast(:age as interval)
				order by updated_at limit :limit""")
			.param("status", status)
			.param("age", age)
			.param("limit", DATED_RECIPES)
			.query((row, index) -> new SiteStats.DatedRecipe(row.getLong("id"), row.getString("title"),
					row.getObject("updated_at", OffsetDateTime.class).toInstant()))
			.list();
	}

	private SiteStats.Recipes recipes() {
		return jdbc.sql("""
				select count(*) as total,
					count(*) filter (where status = 'PUBLISHED') as published,
					count(*) filter (where status = 'DRAFT') as drafts,
					count(*) filter (where image_id is null) as without_photo,
					count(*) filter (where youtube_video_id is not null) as with_video,
					count(*) filter (where id in (select recipe_id from recipe_part
						group by recipe_id having count(*) > 1 or bool_or(title is not null))) as in_parts,
					count(*) filter (where created_at >= now() - interval '30 days') as created_last_30_days,
					count(*) filter (where scheduled_at is not null) as scheduled,
					coalesce(sum(view_count), 0) as views,
					max(updated_at) as last_update
				from recipe""")
			.query((row, index) -> {
				OffsetDateTime lastUpdate = row.getObject("last_update", OffsetDateTime.class);
				return new SiteStats.Recipes(row.getLong("total"), row.getLong("published"), row.getLong("drafts"),
						row.getLong("without_photo"), row.getLong("with_video"), row.getLong("in_parts"),
						row.getLong("created_last_30_days"), row.getLong("scheduled"), row.getLong("views"),
						lastUpdate == null ? null : lastUpdate.toInstant());
			})
			.single();
	}

	private SiteStats.Ingredients ingredients() {
		return jdbc.sql("""
				select count(*) as total,
					count(*) filter (where not exists
						(select 1 from recipe_ingredient line where line.ingredient_id = i.id)) as unused
				from ingredient i""")
			.query((row, index) -> new SiteStats.Ingredients(row.getLong("total"), row.getLong("unused")))
			.single();
	}

	private SiteStats.Images images() {
		return jdbc.sql("""
				select count(*) as total,
					count(*) filter (where not exists (select 1 from recipe r where r.image_id = i.id or r.pinterest_image_id = i.id)
						and not exists (select 1 from category c where c.image_id = i.id)
						and not exists (select 1 from site_content s where s.about_image_id = i.id)) as unused
				from image i""")
			.query((row, index) -> new SiteStats.Images(row.getLong("total"), row.getLong("unused")))
			.single();
	}

	private List<SiteStats.NamedCount> recipesPerCategory() {
		return jdbc.sql("""
				select c.name, count(link.recipe_id) as recipes from category c
				left join recipe_category link on link.category_id = c.id
				group by c.id, c.name order by recipes desc, c.name""")
			.query((row, index) -> new SiteStats.NamedCount(row.getString("name"), row.getLong("recipes")))
			.list();
	}

	/** Recipes, not lines: an ingredient listed in two parts of a recipe counts once. */
	private List<SiteStats.NamedCount> topIngredients() {
		return jdbc.sql("""
				select i.name, count(distinct part.recipe_id) as recipes from recipe_ingredient line
				join ingredient i on i.id = line.ingredient_id
				join recipe_part part on part.id = line.part_id
				group by i.id, i.name order by recipes desc, i.name limit :limit""")
			.param("limit", TOP_INGREDIENTS)
			.query((row, index) -> new SiteStats.NamedCount(row.getString("name"), row.getLong("recipes")))
			.list();
	}

	/** Published only: a draft is viewed by the admins alone, whose visits are not counted. */
	private List<SiteStats.ViewedRecipe> mostViewedRecipes() {
		return jdbc.sql("""
				select id, title, view_count from recipe
				where status = 'PUBLISHED' and view_count > 0
				order by view_count desc, title limit :limit""")
			.param("limit", MOST_VIEWED_RECIPES)
			.query((row, index) -> new SiteStats.ViewedRecipe(row.getLong("id"), row.getString("title"),
					row.getLong("view_count")))
			.list();
	}

	/** Every one of the last 12 months, empty ones included, in Paris time like the site's dates. */
	private List<SiteStats.MonthCount> recipesPerMonth() {
		return jdbc.sql("""
				select to_char(month, 'YYYY-MM') as month, count(r.id) as recipes
				from generate_series(date_trunc('month', now() at time zone 'Europe/Paris') - interval '11 months',
					date_trunc('month', now() at time zone 'Europe/Paris'), interval '1 month') as month
				left join recipe r on date_trunc('month', r.created_at at time zone 'Europe/Paris') = month
				group by month order by month""")
			.query((row, index) -> new SiteStats.MonthCount(row.getString("month"), row.getLong("recipes")))
			.list();
	}

	private SiteStats.Storage storage() {
		Long imageBytes = null;
		Long imageFiles = null;
		try {
			ImageStorage.Usage usage = imageStorage.usage();
			imageBytes = usage.bytes();
			imageFiles = usage.files();
		}
		catch (RuntimeException ex) {
			// The rest of the dashboard stays useful while the bucket cannot be reached.
			log.warn("Image storage usage unavailable", ex);
		}
		long databaseBytes = jdbc.sql("select pg_database_size(current_database())").query(Long.class).single();
		try {
			// This container's root filesystem: in Docker, the server disk holding the containers and
			// their volumes (database, images).
			FileStore disk = Files.getFileStore(Path.of("/"));
			return new SiteStats.Storage(imageBytes, imageFiles, databaseBytes, disk.getTotalSpace(),
					disk.getUsableSpace());
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

}
