-- 2.0.0

-- Ingredients weighed in the recipes but bought by the piece: "400 g (≈ 8 œufs)". The three together, or none.
ALTER TABLE ingredient
    ADD COLUMN piece_grams    numeric(7, 2) CHECK (piece_grams > 0),
    ADD COLUMN piece_singular text          CHECK (char_length(piece_singular) BETWEEN 1 AND 50),
    ADD COLUMN piece_plural   text          CHECK (char_length(piece_plural) BETWEEN 1 AND 50),
    ADD CONSTRAINT ingredient_piece_complete
        CHECK ((piece_grams IS NULL) = (piece_singular IS NULL) AND (piece_grams IS NULL) = (piece_plural IS NULL));

-- A part may be another recipe ("Pâte sablée" in a tart), taken whole times linked_ratio: it then has no ingredient
-- nor step of its own. Deferred: a recipe and the one it links may leave the trash or be deleted in the same save.
ALTER TABLE recipe_part
    ADD COLUMN linked_recipe_id bigint REFERENCES recipe (id) DEFERRABLE INITIALLY DEFERRED,
    ADD COLUMN linked_ratio     numeric(5, 2) CHECK (linked_ratio > 0),
    ADD CONSTRAINT recipe_part_link_complete CHECK ((linked_recipe_id IS NULL) = (linked_ratio IS NULL));

CREATE INDEX recipe_part_linked_recipe_idx ON recipe_part (linked_recipe_id) WHERE linked_recipe_id IS NOT NULL;

-- "Mon CAP": the dated steps of the diploma, as a timeline.
CREATE TABLE cap_entry (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
    body        text        CHECK (char_length(body) <= 10000),
    happened_on date        NOT NULL,
    image_id    uuid        REFERENCES image (id) ON DELETE SET NULL,
    published   boolean     NOT NULL,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL,
    updated_by  text        NOT NULL
);

CREATE INDEX cap_entry_happened_on_idx ON cap_entry (happened_on DESC, id DESC);

-- "Mes observations": a note about a recipe, or about none ("Pas de recette").
CREATE TABLE observation (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
    body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    observed_on date        NOT NULL,
    image_id    uuid        REFERENCES image (id) ON DELETE SET NULL,
    recipe_id   bigint      REFERENCES recipe (id) ON DELETE SET NULL,
    published   boolean     NOT NULL,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL,
    updated_by  text        NOT NULL
);

CREATE INDEX observation_observed_on_idx ON observation (observed_on DESC, id DESC);
CREATE INDEX observation_recipe_idx ON observation (recipe_id) WHERE recipe_id IS NOT NULL;

ALTER TABLE trash_item DROP CONSTRAINT trash_item_kind_check;
ALTER TABLE trash_item ADD CONSTRAINT trash_item_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'MENU', 'IMAGE', 'TAG', 'INGREDIENT', 'GLOSSARY_TERM', 'CAP_ENTRY', 'OBSERVATION'));

-- The shop, one row: closed until the admin opens it.
CREATE TABLE shop_settings (
    id          integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    orders_open boolean     NOT NULL DEFAULT false,
    intro       text        NOT NULL DEFAULT 'Une envie de douceur ? Choisissez vos recettes et Yona vous répond pour convenir de la suite'
                            CHECK (char_length(intro) BETWEEN 1 AND 1000),
    pickup_info text        CHECK (char_length(pickup_info) <= 1000),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  text        NOT NULL DEFAULT 'migration'
);

INSERT INTO shop_settings DEFAULT VALUES;

-- A recipe offered in the shop, once at most. A recipe in the shop is not deleted: it is taken out of the shop first.
CREATE TABLE shop_product (
    id            bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id     bigint        NOT NULL UNIQUE REFERENCES recipe (id),
    price         numeric(8, 2) NOT NULL CHECK (price >= 0),
    portion_label text          CHECK (char_length(portion_label) <= 100),
    available     boolean       NOT NULL,
    updated_at    timestamptz   NOT NULL,
    updated_by    text          NOT NULL
);

-- Orders, in the backups like the rest of the shop. tracking_token: the secret of the visitor's link.
-- Erased 12 months after being finished; the accounting keeps its lines, which hold no personal data.
CREATE TABLE shop_order (
    id             bigint         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tracking_token uuid           NOT NULL UNIQUE,
    status         text           NOT NULL CHECK (status IN ('NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'PICKED_UP', 'CANCELLED')),
    customer_name  text           NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
    customer_email text           CHECK (char_length(customer_email) <= 200),
    customer_phone text           CHECK (char_length(customer_phone) <= 30),
    wanted_on      date,
    message        text           CHECK (char_length(message) <= 2000),
    admin_note     text           CHECK (char_length(admin_note) <= 2000),
    amount         numeric(10, 2) NOT NULL CHECK (amount >= 0),
    handled_by     text,
    created_at     timestamptz    NOT NULL,
    updated_at     timestamptz    NOT NULL,
    CONSTRAINT shop_order_contact CHECK (customer_email IS NOT NULL OR customer_phone IS NOT NULL)
);

CREATE INDEX shop_order_created_at_idx ON shop_order (created_at DESC);
CREATE INDEX shop_order_status_idx ON shop_order (status);

-- What was ordered, as it was at that time: the recipe and its price may change or go, hence no foreign key to it.
CREATE TABLE shop_order_line (
    order_id      bigint        NOT NULL REFERENCES shop_order (id) ON DELETE CASCADE,
    position      integer       NOT NULL,
    recipe_id     bigint,
    title         text          NOT NULL,
    portion_label text,
    unit_price    numeric(8, 2) NOT NULL CHECK (unit_price >= 0),
    quantity      integer       NOT NULL CHECK (quantity BETWEEN 1 AND 50),
    PRIMARY KEY (order_id, position)
);

-- The accounts: money in and out, by admin. order_id: the order it comes from, without foreign key (orders are
-- erased after 12 months while these lines stay).
CREATE TABLE account_entry (
    id          bigint         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        text           NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
    category    text           NOT NULL CHECK (category IN ('SALE', 'INGREDIENTS', 'PACKAGING', 'EQUIPMENT', 'OTHER')),
    occurred_on date           NOT NULL,
    label       text           NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
    amount      numeric(10, 2) NOT NULL CHECK (amount > 0),
    admin_email text           NOT NULL CHECK (char_length(admin_email) <= 254),
    order_id    bigint         UNIQUE,
    created_at  timestamptz    NOT NULL,
    updated_at  timestamptz    NOT NULL,
    updated_by  text           NOT NULL
);

CREATE INDEX account_entry_occurred_on_idx ON account_entry (occurred_on DESC, id DESC);

-- What a device is notified of. Devices subscribed so far are the visitors': new recipes only.
ALTER TABLE push_subscription
    ADD COLUMN new_recipes  boolean NOT NULL DEFAULT true,
    ADD COLUMN admin_orders boolean NOT NULL DEFAULT false;
