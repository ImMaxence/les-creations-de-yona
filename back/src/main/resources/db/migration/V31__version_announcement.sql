-- A new version of the application (2.14), told once by the site itself in the group of all the admins:
-- "Nouvelle version de l'application disponible : version 2.14.0". A line of the group like the others,
-- event_value holding the version.
ALTER TABLE admin_message DROP CONSTRAINT admin_message_event_check;
ALTER TABLE admin_message ADD CONSTRAINT admin_message_event_check
    CHECK (event IN ('CREATED', 'RENAMED', 'PHOTO_CHANGED', 'PHOTO_REMOVED', 'ADDED', 'REMOVED', 'LEFT', 'VERSION'));

-- The versions this server has told of: not again when one starts again, nor when an older one comes back.
-- Tied to this server like admin_seen: saved empty in the backups, left as it is by a restore.
CREATE TABLE announced_version (
    version      text        PRIMARY KEY CHECK (char_length(version) BETWEEN 1 AND 50),
    announced_at timestamptz NOT NULL
);
