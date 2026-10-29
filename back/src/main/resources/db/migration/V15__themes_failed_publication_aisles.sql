-- 1.10.0

-- Every recipe is sweet or savory ("Sucré", "Salé"): a filter of the site, and a featured recipe for
-- each on the home page. Recipes written before are sweet (the site is mostly pastry), to correct
-- by hand.
ALTER TABLE recipe ADD COLUMN theme text NOT NULL DEFAULT 'SWEET' CHECK (theme IN ('SWEET', 'SAVORY'));
ALTER TABLE recipe ALTER COLUMN theme DROP DEFAULT;
CREATE INDEX recipe_theme_published_at_idx ON recipe (theme, status, published_at DESC);

-- A scheduled publication that could not happen: the site was down at that time (more than 30
-- minutes late), a backup older than that time was restored, or the publication kept failing. The
-- recipe stays unpublished, with the reason, until the admin publishes or schedules it again.
ALTER TABLE recipe DROP CONSTRAINT recipe_status_check;
ALTER TABLE recipe ADD CONSTRAINT recipe_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'FAILED'));
ALTER TABLE recipe ADD COLUMN publication_failure text;
ALTER TABLE recipe ADD CONSTRAINT recipe_failure_has_reason CHECK ((status = 'FAILED') = (publication_failure IS NOT NULL));
-- The time planned stays on a failed recipe, shown with the reason
ALTER TABLE recipe DROP CONSTRAINT recipe_scheduled_is_draft;
ALTER TABLE recipe ADD CONSTRAINT recipe_scheduled_is_draft CHECK (scheduled_at IS NULL OR status IN ('DRAFT', 'FAILED'));
ALTER TABLE trash_item DROP CONSTRAINT recipe_trash_status_check;
ALTER TABLE trash_item ADD CONSTRAINT trash_item_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'FAILED'));

-- A featured recipe per theme. A scheduled one may be featured ahead: it shows on the home page once
-- published, in place of the featured recipe of its theme.
ALTER TABLE recipe DROP CONSTRAINT recipe_featured_requires_published;
ALTER TABLE recipe ADD CONSTRAINT recipe_featured_requires_published
    CHECK (NOT featured OR status = 'PUBLISHED' OR scheduled_at IS NOT NULL);
DROP INDEX recipe_single_featured_idx;
CREATE UNIQUE INDEX recipe_single_featured_idx ON recipe (theme) WHERE featured AND status = 'PUBLISHED';

-- Aisles named as in a supermarket: "Boulangerie" goes (bread and cakes are bought, not cooked
-- with), "Rayon frais" comes (charcuterie, ready-made pastry, fresh pasta). The ingredients of the
-- bakery aisle are left without aisle, to sort again.
UPDATE ingredient SET aisle = NULL WHERE aisle = 'BAKERY';
UPDATE trash_item SET content = jsonb_set(content, '{aisle}', 'null') WHERE kind = 'INGREDIENT' AND content ->> 'aisle' = 'BAKERY';
ALTER TABLE ingredient DROP CONSTRAINT ingredient_aisle_check;
ALTER TABLE ingredient ADD CONSTRAINT ingredient_aisle_check CHECK (aisle IN ('FRUITS_VEGETABLES', 'MEAT_FISH', 'FRESH',
    'DAIRY_EGGS', 'SAVORY_GROCERY', 'SWEET_GROCERY', 'FROZEN', 'DRINKS'));
