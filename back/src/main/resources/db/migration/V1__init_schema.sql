-- Case- and accent-insensitive search on recipe titles.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Equality ignores case and accents ("Crème" = "creme"), so UNIQUE rejects such duplicates.
CREATE COLLATION case_accent_insensitive (provider = icu, locale = 'fr-FR-u-ks-level1', deterministic = false);

CREATE TABLE image (
    id          uuid        PRIMARY KEY,
    kind        text        NOT NULL CHECK (kind IN ('RECIPE', 'CATEGORY')),
    s3_prefix   text        NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL
);

CREATE TABLE category (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name      text   NOT NULL,
    slug      text   NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    image_id  uuid   UNIQUE REFERENCES image (id) ON DELETE SET NULL
);

CREATE TABLE recipe (
    id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         text        NOT NULL,
    slug          text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    intro         text,
    status        text        NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
    category_id   bigint      NOT NULL REFERENCES category (id),
    servings      integer     CHECK (servings > 0),
    prep_minutes  integer     CHECK (prep_minutes >= 0),
    cook_minutes  integer     CHECK (cook_minutes >= 0),
    image_id      uuid        UNIQUE REFERENCES image (id) ON DELETE SET NULL,
    featured      boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL,
    updated_at    timestamptz NOT NULL,
    created_by    text        NOT NULL,
    updated_by    text        NOT NULL,
    CONSTRAINT recipe_featured_requires_published CHECK (NOT featured OR status = 'PUBLISHED')
);

-- At most one featured recipe at a time.
CREATE UNIQUE INDEX recipe_single_featured_idx ON recipe (featured) WHERE featured;
CREATE INDEX recipe_category_id_idx ON recipe (category_id);
CREATE INDEX recipe_status_created_at_idx ON recipe (status, created_at DESC);

CREATE TABLE ingredient (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  text   COLLATE case_accent_insensitive NOT NULL UNIQUE
);

CREATE TABLE recipe_ingredient (
    recipe_id      bigint        NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    -- No cascade: deleting an ingredient used by a recipe is refused.
    ingredient_id  bigint        NOT NULL REFERENCES ingredient (id),
    quantity       numeric(8, 2) CHECK (quantity > 0),
    unit           text,
    note           text,
    position       integer       NOT NULL CHECK (position >= 0),
    PRIMARY KEY (recipe_id, ingredient_id),
    -- Deferred to the end of the transaction so a drag-and-drop reorder can swap positions.
    CONSTRAINT recipe_ingredient_position_key UNIQUE (recipe_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX recipe_ingredient_ingredient_id_idx ON recipe_ingredient (ingredient_id);

CREATE TABLE recipe_step (
    recipe_id         bigint  NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    position          integer NOT NULL CHECK (position >= 0),
    description       text    NOT NULL,
    duration_minutes  integer CHECK (duration_minutes > 0),
    PRIMARY KEY (recipe_id, position)
);

CREATE TABLE social_link (
    id        bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform  text    NOT NULL UNIQUE CHECK (platform IN ('YOUTUBE', 'TIKTOK', 'INSTAGRAM')),
    url       text    NOT NULL CHECK (url LIKE 'https://%'),
    position  integer NOT NULL CHECK (position >= 0)
);
