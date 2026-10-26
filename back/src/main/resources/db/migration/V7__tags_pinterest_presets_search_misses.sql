-- Tags of the recipes (végétarien, sans gluten, de saison…), managed in the back-office. Unlike a
-- category, a tag in use can be deleted: it is simply taken off its recipes.
CREATE TABLE tag (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  text   COLLATE case_accent_insensitive NOT NULL UNIQUE,
    slug  text   NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE TABLE recipe_tag (
    recipe_id  bigint NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    tag_id     bigint NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX recipe_tag_tag_id_idx ON recipe_tag (tag_id);

-- Vertical photo offered to Pinterest ("Épingler"), optional: the main photo is used without it.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY', 'SITE', 'PINTEREST'));
ALTER TABLE recipe ADD COLUMN pinterest_image_id uuid REFERENCES image (id) ON DELETE SET NULL;
CREATE INDEX recipe_pinterest_image_id_idx ON recipe (pinterest_image_id);

ALTER TABLE social_link DROP CONSTRAINT social_link_platform_check;
ALTER TABLE social_link ADD CONSTRAINT social_link_platform_check CHECK (platform IN
    ('YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'REDDIT', 'X', 'THREADS', 'WHATSAPP', 'PINTEREST'));

-- Five more color themes and five more title fonts.
ALTER TABLE site_theme DROP CONSTRAINT site_theme_preset_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_preset_check CHECK (preset IN (
    'PATISSERIE_CHIC', 'TERRACOTTA', 'PISTACHE', 'MYRTILLE', 'CARAMEL',
    'FRAMBOISE', 'LAVANDE', 'MENTHE', 'CITRON', 'CHOCOLAT', 'CERISE', 'AMANDE', 'BLEUET', 'ABRICOT', 'FIGUE',
    'NEON', 'ART_DECO', 'LAGON', 'BONBON', 'AURORE'));
ALTER TABLE site_theme DROP CONSTRAINT site_theme_display_font_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_display_font_check CHECK (display_font IN (
    'FRAUNCES', 'PLAYFAIR_DISPLAY', 'CORMORANT_GARAMOND', 'DANCING_SCRIPT', 'QUICKSAND',
    'BODONI_MODA', 'CINZEL', 'EB_GARAMOND', 'CAVEAT', 'COMFORTAA',
    'UNBOUNDED', 'SYNE', 'FREDOKA', 'JOSEFIN_SANS', 'KALNIA'));

-- Looks saved under a name in the back-office (Apparence), applied in one click. Values are
-- checked by the application (same enums as site_theme), so adding a theme or a font does not
-- require changing this table.
CREATE TABLE appearance_preset (
    id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          text        COLLATE case_accent_insensitive NOT NULL UNIQUE,
    preset        text        NOT NULL,
    display_font  text        NOT NULL,
    body_font     text        NOT NULL,
    radius_px     integer     NOT NULL CHECK (radius_px BETWEEN 0 AND 999),
    created_at    timestamptz NOT NULL,
    updated_at    timestamptz NOT NULL,
    updated_by    text        NOT NULL
);

-- What visitors searched for without finding any recipe: the text typed (lower-cased) and how many
-- times, nothing about who searched. Rows older than 12 months are deleted.
CREATE TABLE search_miss (
    term               text        PRIMARY KEY CHECK (length(term) BETWEEN 1 AND 100),
    count              integer     NOT NULL CHECK (count > 0),
    first_searched_at  timestamptz NOT NULL,
    last_searched_at   timestamptz NOT NULL
);
