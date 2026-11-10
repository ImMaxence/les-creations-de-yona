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
import org.jspecify.annotations.Nullable;
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
 * social link by its platform, an image by its id, a glossary word by its name, a menu by its title
 * or slug. Ids of rows created here are new. The trash is not merged: a recipe deleted on the site
 * stays deleted.
 * <p>
 * The texts of the site (Préférences) and its look (Apparence) are one row each, always there: the
 * site "lacks" them while they are still those of the installation, never edited, and then a merge
 * takes the backup's. Edited on the site, they stay as they are.
 */
@Component
@RequiredArgsConstructor
class RestoredData {

	private static final int LISTED_NAMES = 50;

	/** {@code updated_by} of the single-row tables as the migrations created them, never edited since. */
	private static final String INSTALLED_BY = "migration";

	private static final String SITE_CONTENT = "site_content";

	private static final String SITE_THEME = "site_theme";

	private static final String SHOP_SETTINGS = "shop_settings";

	// What identifies these rows for the admin: none of them has a slug or a unique name.

	private static final String CAP_ENTRY_KEY = "select title || '|' || happened_on::text from cap_entry";

	private static final String SHOP_PRODUCT_KEY = "select name from shop_product";

	private static final String ACCOUNT_ENTRY_KEY = """
			select kind || '|' || occurred_on::text || '|' || label || '|' || amount::text || '|' || admin_email from account_entry""";

	private static final String SHOP_ORDER_KEY = "select tracking_token::text from shop_order";

	private static final String INVOICE_KEY = "select number from invoice";

	/**
	 * Every table a merge ("Fusionner") brings in. A test holds it against the migrations: a new table
	 * is listed here (and merged), in {@link #NOT_MERGED} or in {@link BackupService#SITE_ONLY_TABLES},
	 * so that nothing a backup holds is forgotten. "Tout remplacer" copies every table anyway.
	 */
	static final Set<String> MERGED_TABLES = Set.of("image", "category", "tag", "ingredient", "recipe", "recipe_category",
			"recipe_tag", "recipe_question", "recipe_part", "recipe_ingredient", "recipe_step", "social_link", "appearance_preset",
			"glossary_term", "menu", "menu_recipe", "search_miss", "ai_visit", "cap_entry", "shop_product", "shop_order",
			"shop_order_line", "account_entry", "account_purchase_line", "invoice", "invoice_line", "site_content", "site_theme",
			"shop_settings");

	/** Saved, and restored by "Tout remplacer", but left out of a merge: a thing deleted on the site stays deleted. */
	static final Set<String> NOT_MERGED = Set.of("trash_item");

	/** The label of a line of the accounts coming from an order, followed by its number. */
	private static final String ORDER_LABEL = "Commande n° ";

	static final String RESTORED_LATE_FAILURE = "Sauvegarde restaurée après l'heure prévue : la recette n'a pas été publiée";

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
				count(db, "glossary_term"), count(db, "menu"), count(db, "cap_entry"),
				count(db, "shop_product"), count(db, "account_entry"), count(db, "shop_order"), count(db, "invoice"));
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
		Set<String> siteMenuSlugs = strings(site, "select slug from menu");
		Set<String> siteMenuTitles = folded(strings(site, "select title from menu"));
		List<String> menus = scratch.sql("select title, slug from menu order by title").query().listOfRows()
			.stream()
			.filter(row -> !siteMenuSlugs.contains((String) row.get("slug"))
					&& !siteMenuTitles.contains(Texts.foldCaseAndAccents((String) row.get("title"))))
			.map(row -> (String) row.get("title"))
			.toList();
		return new RestoreStatus.Missing(recipes.size(), first(recipes), categories.size(), first(categories), tags.size(),
				first(tags), ingredients, images, platforms.size(), platforms, presets.size(), first(presets), terms.size(),
				first(terms), menus.size(), first(menus), settingsMissing(scratch, site, SITE_CONTENT),
				settingsMissing(scratch, site, SITE_THEME), missingCount(scratch, site, CAP_ENTRY_KEY),
				missingCount(scratch, site, SHOP_PRODUCT_KEY),
				missingCount(scratch, site, ACCOUNT_ENTRY_KEY), missingCount(scratch, site, SHOP_ORDER_KEY), missingCount(scratch, site, INVOICE_KEY));
	}

	/** How many keys of the backup the site lacks. */
	private static long missingCount(JdbcClient scratch, JdbcClient site, String keysSql) {
		Set<String> existing = strings(site, keysSql);
		return strings(scratch, keysSql).stream().filter(key -> !existing.contains(key)).count();
	}

	/** What a merge did: rows added, and whether the texts and the look of the site are now the backup's. */
	record Merged(RestoreStatus.Counts added, boolean siteContent, boolean siteTheme) {
	}

	/**
	 * Adds what the site lacks, without changing nor removing anything. An image is added only if
	 * its two files are in storage ({@code storedKeys}, after the upload of the archive's files).
	 * Added recipes are never featured when the site already has a featured recipe.
	 */
	Merged merge(JdbcClient scratch, Set<String> storedKeys) {
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
			long menus = mergeMenus(scratch, site);
			mergeSearchMisses(scratch, site);
			mergeAiVisits(scratch, site);
			long capEntries = mergeCapEntries(scratch, site);
			Map<Long, Long> products = new HashMap<>();
			long shopProducts = mergeShopProducts(scratch, site, products);
			Map<Long, Long> orders = new HashMap<>();
			long shopOrders = mergeOrders(scratch, site, orders, products);
			long accountEntries = mergeAccountEntries(scratch, site, orders, ingredients);
			long invoices = mergeInvoices(scratch, site, orders);
			continueOrdersAfterAccounts(site);
			boolean siteContent = mergeSettings(scratch, site, SITE_CONTENT);
			boolean siteTheme = mergeSettings(scratch, site, SITE_THEME);
			mergeSettings(scratch, site, SHOP_SETTINGS);
			return new Merged(new RestoreStatus.Counts(added.recipes, added.categories, added.tags, added.ingredients,
					added.images, added.socialLinks, added.presets, glossaryTerms, menus, capEntries, shopProducts,
					accountEntries, shopOrders, invoices), siteContent, siteTheme);
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
		for (Map<String, Object> row : scratch.sql("select id, name, slug, image_id, theme from category").query().listOfRows()) {
			Long siteId = bySlug.get((String) row.get("slug"));
			if (siteId == null) {
				UUID imageId = (UUID) row.get("image_id");
				siteId = site.sql("insert into category (name, slug, image_id, theme) values (:name, :slug, :imageId, :theme) returning id")
					.param("name", row.get("name"))
					.param("theme", row.get("theme"))
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
		for (Map<String, Object> row : scratch.sql("select id, name, aisle, piece_grams, piece_singular, piece_plural from ingredient")
			.query().listOfRows()) {
			// An ingredient already on the site keeps its aisle and its weight; one added comes with the backup's
			added.ingredients += site.sql("""
					insert into ingredient (name, aisle, piece_grams, piece_singular, piece_plural)
					values (:name, :aisle, :piece_grams, :piece_singular, :piece_plural)
					on conflict (name) do nothing""")
				.param("name", row.get("name"))
				.param("aisle", row.get("aisle"))
				.param("piece_grams", row.get("piece_grams"))
				.param("piece_singular", row.get("piece_singular"))
				.param("piece_plural", row.get("piece_plural"))
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
		// One featured recipe at most
		boolean featuredTaken = !strings(site, "select slug from recipe where featured and status = 'PUBLISHED'").isEmpty();
		// Filled once all the recipes are in: a recipe may use one coming later in the backup
		Map<Long, Map<String, Object>> links = new HashMap<>();
		long added = 0;
		for (Map<String, Object> recipe : scratch.sql("select * from recipe order by id").query().listOfRows()) {
			if (existing.contains((String) recipe.get("slug"))) {
				continue;
			}
			Map<String, Object> values = new LinkedHashMap<>(recipe);
			long backupId = ((Number) values.remove("id")).longValue();
			values.computeIfPresent("image_id", (key, id) -> images.contains(id) ? id : null);
			values.computeIfPresent("pinterest_image_id", (key, id) -> images.contains(id) ? id : null);
			// A publication scheduled in the backup is never done by surprise: the admin schedules it again.
			// A recipe featured ahead of its publication is then featured no more.
			boolean featured = Boolean.TRUE.equals(values.get("featured")) && "PUBLISHED".equals(values.get("status"))
					&& !featuredTaken;
			featuredTaken |= featured;
			values.put("featured", featured);
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
			for (Map<String, Object> question : scratch.sql("select position, question, answer from recipe_question where recipe_id = :id")
				.param("id", backupId).query().listOfRows()) {
				site.sql("insert into recipe_question (recipe_id, position, question, answer) values (:recipe, :position, :question, :answer)")
					.param("recipe", siteId)
					.params(question)
					.update();
			}
			for (Map<String, Object> part : scratch.sql("""
					select part.id, part.position, part.title, part.linked_ratio, linked.slug as linked_slug
					from recipe_part part left join recipe linked on linked.id = part.linked_recipe_id
					where part.recipe_id = :id""")
				.param("id", backupId).query().listOfRows()) {
				long partId = site.sql("insert into recipe_part (recipe_id, position, title) values (:recipe, :position, :title) returning id")
					.param("recipe", siteId)
					.param("position", part.get("position"))
					.param("title", part.get("title"))
					.query(Long.class)
					.single();
				if (part.get("linked_slug") != null) {
					links.put(partId, part);
				}
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
		links.forEach((partId, part) -> site.sql("""
				update recipe_part set linked_ratio = :ratio, linked_recipe_id = (select id from recipe where slug = :slug)
				where id = :part""")
			.param("ratio", part.get("linked_ratio"))
			.param("slug", part.get("linked_slug"))
			.param("part", partId)
			.update());
		return added;
	}

	/**
	 * An article the site lacks keeps its address unless the site gave it to another one; it is not put
	 * forward when the site already puts one forward. The photos of its blocks are found by their id:
	 * those the site lacks are left out when it is read.
	 */
	private long mergeCapEntries(JdbcClient scratch, JdbcClient site) {
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		Set<String> existing = strings(site, CAP_ENTRY_KEY);
		Set<String> slugs = strings(site, "select slug from cap_entry");
		boolean featuredTaken = !strings(site, "select slug from cap_entry where featured").isEmpty();
		long added = 0;
		for (Map<String, Object> row : scratch.sql("select *, title || '|' || happened_on::text as merge_key from cap_entry order by id")
			.query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(row);
			if (existing.contains((String) values.remove("merge_key"))) {
				continue;
			}
			values.remove("id");
			values.computeIfPresent("image_id", (key, id) -> images.contains(id) ? id : null);
			String base = (String) values.get("slug");
			String slug = base;
			for (int suffix = 2; slugs.contains(slug); suffix++) {
				slug = base + "-" + suffix;
			}
			slugs.add(slug);
			values.put("slug", slug);
			boolean featured = Boolean.TRUE.equals(values.get("featured")) && !featuredTaken;
			featuredTaken |= featured;
			values.put("featured", featured);
			insertReturningId(site, "cap_entry", values);
			added++;
		}
		return added;
	}

	/**
	 * Products found by their name; one the site already has keeps its price. Their recipe is found by
	 * its address, their category by its address, their photo by its id; those the site lacks are left
	 * out. {@code ids} receives the site's id of each product of the backup.
	 */
	private long mergeShopProducts(JdbcClient scratch, JdbcClient site, Map<Long, Long> ids) {
		Map<String, Long> byName = foldedKeys(idsBy(site, "select id, name as key from shop_product"));
		Map<String, Long> recipes = idsBy(site, "select id, slug as key from recipe");
		Map<String, Long> categories = idsBy(site, "select id, slug as key from category");
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		long added = 0;
		for (Map<String, Object> row : scratch.sql("""
				select shop_product.*, recipe.slug as recipe_slug, category.slug as category_slug
				from shop_product
				left join recipe on recipe.id = shop_product.recipe_id
				left join category on category.id = shop_product.category_id
				order by shop_product.id""").query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(row);
			String recipeSlug = (String) values.remove("recipe_slug");
			String categorySlug = (String) values.remove("category_slug");
			long backupId = ((Number) values.remove("id")).longValue();
			String nameKey = Texts.foldCaseAndAccents((String) values.get("name"));
			Long siteId = byName.get(nameKey);
			if (siteId == null) {
				// A product of a recipe the site lacks would lose its categories and cost price: left out
				if (recipeSlug != null && !recipes.containsKey(recipeSlug)) {
					continue;
				}
				values.put("recipe_id", recipeSlug == null ? null : recipes.get(recipeSlug));
				values.put("category_id", categorySlug == null ? null : categories.get(categorySlug));
				values.computeIfPresent("image_id", (key, id) -> images.contains(id) ? id : null);
				siteId = insertReturningId(site, "shop_product", values);
				byName.put(nameKey, siteId);
				added++;
			}
			ids.put(backupId, siteId);
		}
		return added;
	}

	/**
	 * The orders the site lacks, recognized by the secret of their link; {@code ids} receives the site's
	 * id of each order of the backup. An order keeps its number if the site has not given it to another
	 * one meanwhile. Its lines point to the same recipes, found by their address, and to the same products
	 * ({@code products}: backup id to site id), or to none.
	 */
	private long mergeOrders(JdbcClient scratch, JdbcClient site, Map<Long, Long> ids, Map<Long, Long> products) {
		Map<String, Long> byToken = idsBy(site, "select id, tracking_token::text as key from shop_order");
		Set<Long> taken = new HashSet<>(site.sql("select id from shop_order").query(Long.class).list());
		Map<String, Long> recipes = idsBy(site, "select id, slug as key from recipe");
		long added = 0;
		for (Map<String, Object> row : scratch.sql("select *, tracking_token::text as token from shop_order order by id").query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(row);
			Long siteId = byToken.get((String) values.remove("token"));
			long backupId = ((Number) values.get("id")).longValue();
			if (siteId == null) {
				siteId = insertOrder(site, values, taken.contains(backupId));
				taken.add(siteId);
				copyOrderLines(scratch, site, backupId, siteId, recipes, products);
				added++;
			}
			ids.put(backupId, siteId);
		}
		return added;
	}

	/** {@code numberTaken}: a new number; otherwise the one it had, which the identity column must be told to accept. */
	private static long insertOrder(JdbcClient site, Map<String, Object> values, boolean numberTaken) {
		if (numberTaken) {
			values.remove("id");
			return insertReturningId(site, "shop_order", values);
		}
		return site.sql("insert into shop_order (" + columns(values) + ") overriding system value values (" + parameters(values)
				+ ") returning id")
			.params(values)
			.query(Long.class)
			.single();
	}

	private static void copyOrderLines(JdbcClient scratch, JdbcClient site, long backupId, long siteId, Map<String, Long> recipes,
			Map<Long, Long> products) {
		for (Map<String, Object> line : scratch.sql("""
				select line.position, line.product_id, recipe.slug as recipe_slug, line.title, line.portion_label, line.unit_price, line.quantity
				from shop_order_line line left join recipe on recipe.id = line.recipe_id
				where line.order_id = :id""")
			.param("id", backupId).query().listOfRows()) {
			String recipeSlug = (String) line.get("recipe_slug");
			site.sql("""
					insert into shop_order_line (order_id, position, product_id, recipe_id, title, portion_label, unit_price, quantity)
					values (:order, :position, :product, :recipe, :title, :portion_label, :unit_price, :quantity)""")
				.param("order", siteId)
				.param("position", line.get("position"))
				.param("product", line.get("product_id") == null ? null : products.get(((Number) line.get("product_id")).longValue()))
				.param("recipe", recipeSlug == null ? null : recipes.get(recipeSlug))
				.param("title", line.get("title"))
				.param("portion_label", line.get("portion_label"))
				.param("unit_price", line.get("unit_price"))
				.param("quantity", line.get("quantity"))
				.update();
		}
	}

	/**
	 * The invoices the site lacks, recognized by their number, with their lines, as they were written: an
	 * invoice never changes. Each follows its order to its number on the site (the order may be gone:
	 * erased after 12 months, the invoice keeps it). A number the site already gave stays the site's.
	 */
	private long mergeInvoices(JdbcClient scratch, JdbcClient site, Map<Long, Long> orders) {
		Set<String> existing = strings(site, INVOICE_KEY);
		long added = 0;
		for (Map<String, Object> row : scratch.sql("select * from invoice order by id").query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(row);
			if (existing.contains((String) values.get("number"))) {
				continue;
			}
			long backupId = ((Number) values.remove("id")).longValue();
			long orderId = ((Number) values.get("order_id")).longValue();
			values.put("order_id", orders.getOrDefault(orderId, orderId));
			Long siteId = site.sql("insert into invoice (" + columns(values) + ") values (" + parameters(values)
					+ ") on conflict do nothing returning id")
				.params(values)
				.query(Long.class)
				.optional()
				.orElse(null);
			if (siteId == null) {
				continue;
			}
			added++;
			for (Map<String, Object> line : scratch.sql("select position, label, detail, quantity, unit_price from invoice_line where invoice_id = :id")
				.param("id", backupId).query().listOfRows()) {
				site.sql("""
						insert into invoice_line (invoice_id, position, label, detail, quantity, unit_price)
						values (:invoice, :position, :label, :detail, :quantity, :unit_price)""")
					.param("invoice", siteId)
					.params(line)
					.update();
			}
		}
		return added;
	}

	/**
	 * A line coming from an order follows it to its number on the site. Its order gone from the backup
	 * (erased after 12 months), it keeps its number, unless the site gave it to another order: it then
	 * becomes a plain line, never counted for an order that is not its own. Its receipt comes along if the
	 * site has it; its purchases point to the same ingredients ({@code ingredients}: backup id to site id).
	 */
	private long mergeAccountEntries(JdbcClient scratch, JdbcClient site, Map<Long, Long> orders, Map<Long, Long> ingredients) {
		Set<String> existing = strings(site, ACCOUNT_ENTRY_KEY);
		Set<Long> siteOrders = new HashSet<>(site.sql("select id from shop_order").query(Long.class).list());
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		long added = 0;
		for (Map<String, Object> row : scratch.sql("""
				select *, kind || '|' || occurred_on::text || '|' || label || '|' || amount::text || '|' || admin_email as merge_key
				from account_entry order by id""").query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(row);
			if (existing.contains((String) values.remove("merge_key"))) {
				continue;
			}
			long backupId = ((Number) values.remove("id")).longValue();
			Number orderId = (Number) values.get("order_id");
			if (orderId != null) {
				pointToOrder(values, orderId.longValue(), orders, siteOrders);
			}
			values.computeIfPresent("receipt_image_id", (key, id) -> images.contains(id) ? id : null);
			Long siteId = site.sql("insert into account_entry (" + columns(values) + ") values (" + parameters(values)
					+ ") on conflict do nothing returning id")
				.params(values)
				.query(Long.class)
				.optional()
				.orElse(null);
			if (siteId == null) {
				continue;
			}
			added++;
			for (Map<String, Object> line : scratch.sql("""
					select position, item, ingredient_id, quantity, unit, price from account_purchase_line where entry_id = :id""")
				.param("id", backupId).query().listOfRows()) {
				Number ingredientId = (Number) line.get("ingredient_id");
				site.sql("""
						insert into account_purchase_line (entry_id, position, item, ingredient_id, quantity, unit, price)
						values (:entry, :position, :item, :ingredient, :quantity, :unit, :price)""")
					.param("entry", siteId)
					.param("position", line.get("position"))
					.param("item", line.get("item"))
					.param("ingredient", ingredientId == null ? null : ingredients.get(ingredientId.longValue()))
					.param("quantity", line.get("quantity"))
					.param("unit", line.get("unit"))
					.param("price", line.get("price"))
					.update();
			}
		}
		return added;
	}

	private static void pointToOrder(Map<String, Object> values, long orderId, Map<Long, Long> orders, Set<Long> siteOrders) {
		Long siteId = orders.get(orderId);
		if (siteId == null) {
			if (siteOrders.contains(orderId)) {
				values.put("order_id", null);
			}
		}
		else if (siteId != orderId) {
			values.put("order_id", siteId);
			if ((ORDER_LABEL + orderId).equals(values.get("label"))) {
				values.put("label", ORDER_LABEL + siteId);
			}
		}
	}

	/**
	 * Lines of the accounts outlive their order, erased after 12 months: on a new server, order numbers
	 * must not start over, or a new order would be taken for the old one sharing its number.
	 */
	private static void continueOrdersAfterAccounts(JdbcClient site) {
		site.sql("""
				select setval(pg_get_serial_sequence('public.shop_order', 'id'),
					greatest((select coalesce(max(id), 0) from shop_order), (select coalesce(max(order_id), 0) from account_entry)) + 1, false)""")
			.query()
			.listOfRows();
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
	 * A menu whose title or address the site already has is left out. Its recipes are found by their
	 * address, once the backup's recipes are merged; those the site lacks are left out, as its photo.
	 */
	private long mergeMenus(JdbcClient scratch, JdbcClient site) {
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		long added = 0;
		for (Map<String, Object> menu : scratch.sql("select * from menu order by id").query().listOfRows()) {
			Map<String, Object> values = new LinkedHashMap<>(menu);
			long backupId = ((Number) values.remove("id")).longValue();
			// Its photo, if the site has it (in the gallery, or added from the backup); else the default visual
			values.computeIfPresent("image_id", (key, id) -> images.contains(id) ? id : null);
			Long siteId = site.sql("insert into menu (" + columns(values) + ") values (" + parameters(values)
					+ ") on conflict do nothing returning id")
				.params(values)
				.query(Long.class)
				.optional()
				.orElse(null);
			if (siteId == null) {
				continue;
			}
			added++;
			int position = 0;
			for (String slug : scratch.sql("""
					select recipe.slug from menu_recipe join recipe on recipe.id = menu_recipe.recipe_id
					where menu_recipe.menu_id = :id order by menu_recipe.position""")
				.param("id", backupId).query(String.class).list()) {
				position += site.sql("""
						insert into menu_recipe (menu_id, recipe_id, position)
						select :menu, id, :position from recipe where slug = :slug""")
					.param("menu", siteId)
					.param("position", position)
					.param("slug", slug)
					.update();
			}
		}
		return added;
	}

	/** Searches that found nothing (Statistiques): the words the site lacks, with their count. */
	private void mergeSearchMisses(JdbcClient scratch, JdbcClient site) {
		for (Map<String, Object> row : scratch.sql("select term, count, first_searched_at, last_searched_at from search_miss")
			.query().listOfRows()) {
			site.sql("""
					insert into search_miss (term, count, first_searched_at, last_searched_at)
					values (:term, :count, :first_searched_at, :last_searched_at)
					on conflict (term) do nothing""")
				.params(row)
				.update();
		}
	}

	/** Visits coming from AI assistants (Statistiques): the days the site has not counted yet. */
	private void mergeAiVisits(JdbcClient scratch, JdbcClient site) {
		for (Map<String, Object> row : scratch.sql("select day, assistant, count from ai_visit").query().listOfRows()) {
			site.sql("insert into ai_visit (day, assistant, count) values (:day, :assistant, :count) on conflict do nothing")
				.params(row)
				.update();
		}
	}

	/**
	 * The backup's row of a single-row table in place of the site's, if the site's was never edited.
	 * The photo of "À propos" comes along if the site has it (in the gallery, or added from the backup).
	 */
	private boolean mergeSettings(JdbcClient scratch, JdbcClient site, String table) {
		if (!settingsMissing(scratch, site, table)) {
			return false;
		}
		Set<UUID> images = new HashSet<>(site.sql("select id from image").query(UUID.class).list());
		Map<String, Object> values = new LinkedHashMap<>(scratch.sql("select * from " + table).query().singleRow());
		values.remove("id");
		values.computeIfPresent("about_image_id", (key, id) -> images.contains(id) ? id : null);
		site.sql("update " + table + " set " + values.keySet().stream()
			.map(column -> quoted(column) + " = :" + column)
			.collect(Collectors.joining(", ")))
			.params(values)
			.update();
		return true;
	}

	/** Still the installation's on the site, edited in the backup. */
	private static boolean settingsMissing(JdbcClient scratch, JdbcClient site, String table) {
		String backup = updatedBy(scratch, table);
		return backup != null && !backup.equals(INSTALLED_BY) && INSTALLED_BY.equals(updatedBy(site, table));
	}

	private static @Nullable String updatedBy(JdbcClient db, String table) {
		return db.sql("select updated_by from " + table).query(String.class).optional().orElse(null);
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
			// A publication scheduled in the past would happen within a minute, notification included: it
			// fails instead, and the admin publishes it or schedules it again
			site.sql("""
					update recipe set status = 'FAILED', publication_failure = :reason
					where status = 'DRAFT' and scheduled_at < now()""")
				.param("reason", RESTORED_LATE_FAILURE)
				.update();
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
			continueOrdersAfterAccounts(site);
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
		return site.sql("insert into " + table + " (" + columns(values) + ") values (" + parameters(values) + ") returning id")
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

	/** Column names of a row, quoted. */
	private static String columns(Map<String, Object> values) {
		return values.keySet().stream().map(RestoredData::quoted).collect(Collectors.joining(", "));
	}

	private static String parameters(Map<String, Object> values) {
		return values.keySet().stream().map(column -> ":" + column).collect(Collectors.joining(", "));
	}

}
