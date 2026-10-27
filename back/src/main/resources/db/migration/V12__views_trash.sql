-- Times a published recipe was opened on the site, counted by the browser once per visit (see
-- RecipeService.recordView); the admins' own visits do not count. Nothing about the visitor is kept.
ALTER TABLE recipe ADD COLUMN view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0);

-- The trash also keeps deleted categories, menus and photos, 30 days like the recipes.
-- kind: what it holds. slug and status: a recipe's (a category's or a menu's slug), none for a photo.
-- image_id: the photo shown next to it (a recipe's, a category's, a menu's first recipe's); a
-- deleted photo is no longer in the image table: its id and S3 folder are in content, its files
-- stay in the bucket until it is erased.
-- links: where it was shown, to put it back there (the menus of a recipe, the recipes and
-- categories of a photo). view_count: a recipe's views, given back on restore.
ALTER TABLE recipe_trash RENAME TO trash_item;
ALTER TABLE trash_item RENAME CONSTRAINT recipe_trash_pkey TO trash_item_pkey;
ALTER INDEX recipe_trash_deleted_at_idx RENAME TO trash_item_deleted_at_idx;
ALTER TABLE trash_item ADD COLUMN kind text NOT NULL DEFAULT 'RECIPE'
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'MENU', 'IMAGE'));
ALTER TABLE trash_item ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE trash_item ALTER COLUMN slug DROP NOT NULL;
ALTER TABLE trash_item ALTER COLUMN status DROP NOT NULL;
ALTER TABLE trash_item ADD COLUMN links jsonb;
ALTER TABLE trash_item ADD COLUMN view_count bigint CHECK (view_count >= 0);
ALTER TABLE trash_item ADD CONSTRAINT trash_item_status_check_kind CHECK ((kind = 'RECIPE') = (status IS NOT NULL));
