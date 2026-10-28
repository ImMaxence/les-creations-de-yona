-- 3.9.0

-- Titles of the home page sections, edited in the back-office (Préférences): the small line above
-- (eyebrow) and the heading of the latest recipes, the menus and the categories.
ALTER TABLE site_content
    ADD COLUMN latest_eyebrow     text NOT NULL DEFAULT 'Fraîchement publiées',
    ADD COLUMN latest_title       text NOT NULL DEFAULT 'Dernières recettes',
    ADD COLUMN menus_eyebrow      text NOT NULL DEFAULT 'Pour chaque occasion',
    ADD COLUMN menus_title        text NOT NULL DEFAULT 'Nos menus',
    ADD COLUMN categories_eyebrow text NOT NULL DEFAULT 'Envie d''une douceur ?',
    ADD COLUMN categories_title   text NOT NULL DEFAULT 'Catégories';

-- The trash also keeps deleted tags, ingredients and words of the glossary.
ALTER TABLE trash_item DROP CONSTRAINT trash_item_kind_check;
ALTER TABLE trash_item ADD CONSTRAINT trash_item_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'MENU', 'IMAGE', 'TAG', 'INGREDIENT', 'GLOSSARY_TERM'));

-- History of the back-office: who did what, and when. label: the title or name at that time;
-- target_id: to link to it while it exists. Action and kind checked by the application, without
-- CHECK constraint: a new kind of change needs no migration. Kept 6 months, erased every night.
-- Tied to this server: saved empty in backups, never touched by a restore.
CREATE TABLE audit_event (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    happened_at timestamptz NOT NULL,
    actor       text        NOT NULL,
    action      text        NOT NULL,
    kind        text        NOT NULL,
    label       text        NOT NULL,
    target_id   bigint
);

CREATE INDEX audit_event_happened_at_idx ON audit_event (happened_at DESC);

-- Messages sent by visitors ("Donner mon avis"). email: optional, for an answer. page: where the
-- visitor was. read_at: read in the back-office. Kept 12 months at most. Tied to this server, like
-- the history: saved empty in backups (the emails do not leave the server).
CREATE TABLE feedback (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at  timestamptz NOT NULL,
    message     text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    email       text        CHECK (char_length(email) <= 200),
    page        text        CHECK (char_length(page) <= 300),
    read_at     timestamptz
);

CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
