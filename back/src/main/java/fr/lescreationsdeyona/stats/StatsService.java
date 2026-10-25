package fr.lescreationsdeyona.stats;

import fr.lescreationsdeyona.image.ImageStorage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
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

	private final JdbcClient jdbc;

	private final ImageStorage imageStorage;

	public SiteStats compute() {
		return new SiteStats(recipes(), jdbc.sql("select count(*) from category").query(Long.class).single(),
				ingredients(), images(), recipesPerCategory(), topIngredients(), recipesPerMonth(), storage(),
				Instant.now());
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
					max(updated_at) as last_update
				from recipe""")
			.query((row, index) -> {
				OffsetDateTime lastUpdate = row.getObject("last_update", OffsetDateTime.class);
				return new SiteStats.Recipes(row.getLong("total"), row.getLong("published"), row.getLong("drafts"),
						row.getLong("without_photo"), row.getLong("with_video"), row.getLong("in_parts"),
						row.getLong("created_last_30_days"), lastUpdate == null ? null : lastUpdate.toInstant());
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
					count(*) filter (where not exists (select 1 from recipe r where r.image_id = i.id)
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
