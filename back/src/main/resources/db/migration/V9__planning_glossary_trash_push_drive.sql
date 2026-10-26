-- Rest time (resting, rising…), counted in the total time with preparation and cooking.
ALTER TABLE recipe ADD COLUMN rest_minutes integer CHECK (rest_minutes >= 0);

-- "Le conseil de Yona": tip, storage, variant…, in Markdown, shown after the steps.
ALTER TABLE recipe ADD COLUMN tip text;

-- Mold the quantities are written for, so that visitors can adapt them to theirs: the diameter of a
-- round one, the side of a square one, the length and width of a rectangular one.
ALTER TABLE recipe
    ADD COLUMN mold_shape text CHECK (mold_shape IN ('ROUND', 'SQUARE', 'RECTANGLE')),
    ADD COLUMN mold_length_cm numeric(4, 1) CHECK (mold_length_cm > 0),
    ADD COLUMN mold_width_cm numeric(4, 1) CHECK (mold_width_cm > 0),
    ADD CONSTRAINT recipe_mold_complete CHECK (
        (mold_shape IS NULL AND mold_length_cm IS NULL AND mold_width_cm IS NULL)
        OR (mold_shape IN ('ROUND', 'SQUARE') AND mold_length_cm IS NOT NULL AND mold_width_cm IS NULL)
        OR (mold_shape = 'RECTANGLE' AND mold_length_cm IS NOT NULL AND mold_width_cm IS NOT NULL));

-- First publication: the date shown on the cards, the order of the recipes, and the notification
-- sent once. Recipes already online were published when created, as far as anyone knows.
ALTER TABLE recipe ADD COLUMN published_at timestamptz;
UPDATE recipe SET published_at = created_at WHERE status = 'PUBLISHED';
ALTER TABLE recipe ADD CONSTRAINT recipe_published_has_date CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL);
CREATE INDEX recipe_status_published_at_idx ON recipe (status, published_at DESC);

-- Scheduled publication of a draft ("publier samedi à 10 h"), done by the backend within a minute.
ALTER TABLE recipe ADD COLUMN scheduled_at timestamptz;
ALTER TABLE recipe ADD CONSTRAINT recipe_scheduled_is_draft CHECK (scheduled_at IS NULL OR status = 'DRAFT');
CREATE INDEX recipe_scheduled_at_idx ON recipe (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Ingredients needed by a step, shown alone in the cooking mode: positions in the ingredient list
-- of its part (0 for the first one). Empty: the step does not say, the whole list is shown.
ALTER TABLE recipe_step ADD COLUMN ingredient_positions integer[] NOT NULL DEFAULT '{}';

-- Deleted recipes, kept 30 days before being erased: the recipe as the back-office edits it (JSON),
-- so that nothing else in the database has to tell deleted recipes apart. Restoring creates it again.
CREATE TABLE recipe_trash (
    id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               text        NOT NULL,
    slug                text        NOT NULL,
    status              text        NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
    image_id            uuid        REFERENCES image (id) ON DELETE SET NULL,
    pinterest_image_id  uuid        REFERENCES image (id) ON DELETE SET NULL,
    content             jsonb       NOT NULL,
    deleted_at          timestamptz NOT NULL,
    deleted_by          text        NOT NULL
);

CREATE INDEX recipe_trash_deleted_at_idx ON recipe_trash (deleted_at);

-- Pastry words (émulsionner, chemiser…) explained on the glossary page and in the recipe steps.
-- forms: other spellings found in steps (conjugated verbs, plurals…), matched like the name.
CREATE TABLE glossary_term (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text        COLLATE case_accent_insensitive NOT NULL UNIQUE,
    slug        text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    definition  text        NOT NULL,
    forms       text[]      NOT NULL DEFAULT '{}',
    updated_at  timestamptz NOT NULL,
    updated_by  text        NOT NULL
);

-- Browsers to notify of a new recipe (Web Push): the push service address and the browser's keys,
-- nothing about the visitor. Deleted when the visitor unsubscribes or the push service drops it.
CREATE TABLE push_subscription (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    endpoint    text        NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
    p256dh      text        NOT NULL,
    auth        text        NOT NULL,
    created_at  timestamptz NOT NULL
);

-- VAPID key pair of the site (P-256, base64url), created at the first start. Changing it would
-- invalidate every subscription.
CREATE TABLE web_push_key (
    id           smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    public_key   text        NOT NULL,
    private_key  text        NOT NULL,
    created_at   timestamptz NOT NULL
);

-- Google Drive account receiving the nightly backups, and how the last one went. The refresh token
-- is useless without the OAuth client secret, which only lives in the environment.
CREATE TABLE google_drive_link (
    id                 smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    account_email      text        NOT NULL,
    refresh_token      text        NOT NULL,
    folder_id          text,
    connected_at       timestamptz NOT NULL,
    connected_by       text        NOT NULL,
    last_backup_at     timestamptz,
    last_backup_ok     boolean,
    last_backup_error  text,
    last_backup_file   text,
    last_backup_bytes  bigint
);
