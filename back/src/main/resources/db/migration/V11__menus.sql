-- Menus put together by the admin ("Menu de Noël", "Goûter d'anniversaire"): a few recipes on a
-- page of their own, added to the shopping list at once. Shown on the site once published; their
-- photo is the one of their first recipe.
CREATE TABLE menu (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       text        COLLATE case_accent_insensitive NOT NULL UNIQUE,
    slug        text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    intro       text,
    published   boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL,
    updated_by  text        NOT NULL
);

-- Its recipes, in order. A recipe deleted (put in the trash) leaves its menus.
CREATE TABLE menu_recipe (
    menu_id    bigint  NOT NULL REFERENCES menu (id) ON DELETE CASCADE,
    recipe_id  bigint  NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    position   integer NOT NULL CHECK (position >= 0),
    PRIMARY KEY (menu_id, position),
    -- Deferred: reordering swaps two recipes within the transaction
    CONSTRAINT menu_recipe_recipe_key UNIQUE (menu_id, recipe_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX menu_recipe_recipe_id_idx ON menu_recipe (recipe_id);
