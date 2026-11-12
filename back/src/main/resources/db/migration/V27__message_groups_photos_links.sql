-- 2.9.0. "Messages": groups of admins (a name, a photo, their members), photos in the messages, and the
-- preview of the first link of a message (the title, the text and the image of its page), as it was when sent.

-- The photos of the messages, of the groups and of the previews: never in the gallery, nor on the site.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY', 'SITE', 'PINTEREST', 'MENU', 'RECEIPT', 'MESSAGE'));

-- A group of admins. The group of all of them ("everyone") holds every account allowed into the
-- back-office, whoever they are: its members are not listed. Each other group lists its own.
CREATE TABLE admin_group (
    id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    image_id   uuid        REFERENCES image (id) ON DELETE SET NULL,
    everyone   boolean     NOT NULL DEFAULT false,
    created_by text        NOT NULL CHECK (char_length(created_by) BETWEEN 1 AND 320),
    created_at timestamptz NOT NULL,
    updated_by text        CHECK (char_length(updated_by) <= 320),
    updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX admin_group_everyone_idx ON admin_group (everyone) WHERE everyone;

CREATE TABLE admin_group_member (
    group_id bigint NOT NULL REFERENCES admin_group (id) ON DELETE CASCADE,
    email    text   NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320 AND email = lower(email)),
    PRIMARY KEY (group_id, email)
);

CREATE INDEX admin_group_member_email_idx ON admin_group_member (email);

INSERT INTO admin_group (name, everyone, created_by, created_at, updated_at)
VALUES ('Tous les admins', true, 'migration', now(), now());

-- The messages written before the groups are those of all the admins.
ALTER TABLE admin_message ADD COLUMN group_id bigint REFERENCES admin_group (id) ON DELETE CASCADE;
UPDATE admin_message SET group_id = (SELECT id FROM admin_group WHERE everyone);
ALTER TABLE admin_message ALTER COLUMN group_id SET NOT NULL;
CREATE INDEX admin_message_group_idx ON admin_message (group_id, id);

-- A message may be photos alone.
ALTER TABLE admin_message DROP CONSTRAINT admin_message_body_check;
ALTER TABLE admin_message ADD CONSTRAINT admin_message_body_check CHECK (char_length(body) <= 4000);

-- The preview of its first link, read on its page once sent.
ALTER TABLE admin_message
    ADD COLUMN link_url          text    CHECK (char_length(link_url) <= 2000),
    ADD COLUMN link_title        text    CHECK (char_length(link_title) <= 300),
    ADD COLUMN link_description  text    CHECK (char_length(link_description) <= 500),
    ADD COLUMN link_site         text    CHECK (char_length(link_site) <= 100),
    ADD COLUMN link_image_id     uuid    REFERENCES image (id) ON DELETE SET NULL,
    ADD COLUMN link_image_width  integer CHECK (link_image_width > 0),
    ADD COLUMN link_image_height integer CHECK (link_image_height > 0);

-- Its photos, in the order chosen, with their size: the conversation keeps its place while they load.
CREATE TABLE admin_message_image (
    message_id bigint   NOT NULL REFERENCES admin_message (id) ON DELETE CASCADE,
    position   smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
    image_id   uuid     NOT NULL REFERENCES image (id),
    width      integer  NOT NULL CHECK (width BETWEEN 1 AND 20000),
    height     integer  NOT NULL CHECK (height BETWEEN 1 AND 20000),
    PRIMARY KEY (message_id, position)
);

CREATE INDEX admin_message_image_image_idx ON admin_message_image (image_id);

-- When each admin last read each group: the badges count what the others wrote after. Tied to this
-- server like admin_seen (saved empty in the backups), hence no foreign key: a restore empties the groups.
CREATE TABLE admin_group_seen (
    group_id    bigint      NOT NULL,
    admin_email text        NOT NULL CHECK (char_length(admin_email) BETWEEN 3 AND 320),
    seen_at     timestamptz NOT NULL,
    PRIMARY KEY (group_id, admin_email)
);
