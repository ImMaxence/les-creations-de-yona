-- 2.8.0. "Messages": what the admins write to each other, all of them in one group. A mention of a
-- thing of the site is written in the text itself: @[Tarte au citron](RECIPE:12). Kept 90 days, and in
-- the backups.
CREATE TABLE admin_message (
    id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_email   text        NOT NULL CHECK (char_length(author_email) BETWEEN 3 AND 320),
    author_name    text        CHECK (char_length(author_name) <= 200),
    author_picture text        CHECK (char_length(author_picture) <= 2000),
    body           text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    sent_at        timestamptz NOT NULL
);

CREATE INDEX admin_message_sent_at_idx ON admin_message (sent_at);

-- Its badge: the messages of the others since this admin last opened the page.
ALTER TABLE admin_seen DROP CONSTRAINT admin_seen_topic_check;
ALTER TABLE admin_seen ADD CONSTRAINT admin_seen_topic_check CHECK (topic IN ('HISTORY', 'CHANGELOG', 'LOGS', 'TRASH', 'MESSAGES'));
