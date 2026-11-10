-- 2.4.0

-- "Mon CAP" in articles: each step becomes an article with its own page, /mon-cap/{slug}, made of blocks
-- (text, photos, photo and text, steps in photos, tip) kept as a JSON array. The photos of the blocks are found by
-- their id in the gallery; one gone from it is left out when the article is read.
ALTER TABLE cap_entry
    ADD COLUMN subtitle text    CHECK (char_length(subtitle) <= 200),
    ADD COLUMN slug     text,
    ADD COLUMN style    text    NOT NULL DEFAULT 'CLASSIC' CHECK (style IN ('CLASSIC', 'NOTEBOOK')),
    ADD COLUMN blocks   text    NOT NULL DEFAULT '[]' CHECK (blocks IS JSON ARRAY AND char_length(blocks) <= 300000),
    -- "Mettre en avant": shown on the home page in place of the latest article, one at most
    ADD COLUMN featured boolean NOT NULL DEFAULT false;

-- "Mes observations" leave the site: each becomes an article kept as a draft, its recipe named at the end of its text.
INSERT INTO cap_entry (title, body, happened_on, image_id, published, created_at, updated_at, updated_by)
SELECT observation.title,
       observation.body || coalesce(E'\n\nRecette : [' || recipe.title || '](/recettes/' || category.slug || '/' || recipe.slug || ')', ''),
       observation.observed_on, observation.image_id, false, observation.created_at, observation.updated_at, observation.updated_by
FROM observation
LEFT JOIN recipe ON recipe.id = observation.recipe_id
LEFT JOIN recipe_category ON recipe_category.recipe_id = recipe.id AND recipe_category.position = 0
LEFT JOIN category ON category.id = recipe_category.category_id
ORDER BY observation.id;

-- The text of a step becomes the Text block of its article, nothing lost; style "Classique".
UPDATE cap_entry
SET blocks = CASE WHEN body IS NULL THEN '[]' ELSE jsonb_build_array(jsonb_build_object('type', 'TEXT', 'text', body))::text END;

-- Its address, from its title, as the back-office makes it (Slugs): "Mon premier examen blanc" → mon-premier-examen-blanc.
WITH bases AS (
    SELECT id,
           coalesce(nullif(trim(BOTH '-' FROM regexp_replace(unaccent(replace(replace(lower(title), 'œ', 'oe'), 'æ', 'ae')),
                                                            '[^a-z0-9]+', '-', 'g')), ''), 'article') AS base
    FROM cap_entry
), numbered AS (
    SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rank FROM bases
)
UPDATE cap_entry
-- "observations" stays the old address of "Mes observations", sent to /mon-cap
SET slug = CASE
    WHEN numbered.base = 'observations' THEN numbered.base || '-' || (numbered.rank + 1)
    WHEN numbered.rank = 1 THEN numbered.base
    ELSE numbered.base || '-' || numbered.rank END
FROM numbered
WHERE numbered.id = cap_entry.id;

ALTER TABLE cap_entry
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT cap_entry_slug_key UNIQUE (slug),
    ADD CONSTRAINT cap_entry_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 200),
    DROP COLUMN body;

CREATE UNIQUE INDEX cap_entry_single_featured_idx ON cap_entry (featured) WHERE featured;

-- Observations in the trash come back as draft articles.
UPDATE trash_item
SET kind    = 'CAP_ENTRY',
    content = jsonb_build_object(
        'title', content -> 'title',
        'body', (content ->> 'body') || coalesce((
            SELECT E'\n\nRecette : [' || recipe.title || '](/recettes/' || category.slug || '/' || recipe.slug || ')'
            FROM recipe
            JOIN recipe_category ON recipe_category.recipe_id = recipe.id AND recipe_category.position = 0
            JOIN category ON category.id = recipe_category.category_id
            WHERE recipe.id = (trash_item.content ->> 'recipeId')::bigint), ''),
        'happenedOn', content -> 'observedOn',
        'published', false)
WHERE kind = 'OBSERVATION';

ALTER TABLE trash_item DROP CONSTRAINT trash_item_kind_check;
ALTER TABLE trash_item ADD CONSTRAINT trash_item_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'MENU', 'IMAGE', 'TAG', 'INGREDIENT', 'GLOSSARY_TERM', 'CAP_ENTRY'));

DROP TABLE observation;

-- The shop in three positions: closed, for the people close to Yona (now), open to all (later).
ALTER TABLE shop_settings
    ADD COLUMN mode text NOT NULL DEFAULT 'CLOSED' CHECK (mode IN ('CLOSED', 'FRIENDS', 'OPEN'));
UPDATE shop_settings SET mode = CASE WHEN orders_open THEN 'FRIENDS' ELSE 'CLOSED' END;
ALTER TABLE shop_settings DROP COLUMN orders_open;

-- A product has its own name and photo (taken from its recipe at first), a format (by the unit, or by batches of
-- batch_size), and what its cost price needs: the share of its recipe it takes, its packaging. A product without
-- recipe has its own category. A recipe may now be sold in several products (a box of 6, a box of 12).
ALTER TABLE shop_product
    ADD COLUMN name            text,
    ADD COLUMN image_id        uuid          REFERENCES image (id) ON DELETE SET NULL,
    ADD COLUMN category_id     bigint        REFERENCES category (id) ON DELETE SET NULL,
    ADD COLUMN batch_size      integer       CHECK (batch_size BETWEEN 2 AND 1000),
    ADD COLUMN recipe_share    numeric(6, 3) NOT NULL DEFAULT 1 CHECK (recipe_share > 0),
    ADD COLUMN packaging       text          CHECK (char_length(packaging) BETWEEN 1 AND 100),
    ADD COLUMN packaging_count integer       NOT NULL DEFAULT 1 CHECK (packaging_count BETWEEN 1 AND 100);

UPDATE shop_product SET name = recipe.title, image_id = recipe.image_id FROM recipe WHERE recipe.id = shop_product.recipe_id;

ALTER TABLE shop_product
    ALTER COLUMN name SET NOT NULL,
    ADD CONSTRAINT shop_product_name_check CHECK (char_length(name) BETWEEN 1 AND 150),
    ALTER COLUMN recipe_id DROP NOT NULL,
    DROP CONSTRAINT shop_product_recipe_id_key;

CREATE INDEX shop_product_recipe_idx ON shop_product (recipe_id) WHERE recipe_id IS NOT NULL;

-- The product a line of an order comes from, without foreign key (as the recipe): for the best sales and margins.
ALTER TABLE shop_order_line ADD COLUMN product_id bigint;
UPDATE shop_order_line SET product_id = shop_product.id FROM shop_product WHERE shop_product.recipe_id = shop_order_line.recipe_id;

-- A photo of the receipt of an expense, apart from the gallery.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY', 'SITE', 'PINTEREST', 'MENU', 'RECEIPT'));

ALTER TABLE account_entry ADD COLUMN receipt_image_id uuid REFERENCES image (id) ON DELETE SET NULL;

-- What a purchase was made of: an ingredient of the site (or packaging), its quantity and the price paid. The last
-- price paid for each makes the cost price of the products. The item's name is kept if the ingredient goes.
CREATE TABLE account_purchase_line (
    entry_id      bigint         NOT NULL REFERENCES account_entry (id) ON DELETE CASCADE,
    position      integer        NOT NULL CHECK (position >= 0),
    item          text           NOT NULL CHECK (char_length(item) BETWEEN 1 AND 100),
    ingredient_id bigint         REFERENCES ingredient (id) ON DELETE SET NULL,
    quantity      numeric(10, 3) NOT NULL CHECK (quantity > 0),
    unit          text           NOT NULL CHECK (unit IN ('G', 'KG', 'ML', 'CL', 'L', 'PIECE')),
    price         numeric(10, 2) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (entry_id, position)
);

CREATE INDEX account_purchase_line_ingredient_idx ON account_purchase_line (ingredient_id) WHERE ingredient_id IS NOT NULL;

-- A word kept for later ("Garder pour plus tard"): without definition, shown nowhere on the site until it has one.
ALTER TABLE glossary_term ALTER COLUMN definition DROP NOT NULL;
