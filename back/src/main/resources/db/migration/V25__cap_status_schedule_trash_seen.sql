-- 2.8.0. Articles of "Mon CAP": a status like the recipes (draft, published, failed) in place of
-- "published", and a scheduled publication, done by the backend at that time.
ALTER TABLE cap_entry ADD COLUMN status text;
UPDATE cap_entry SET status = CASE WHEN published THEN 'PUBLISHED' ELSE 'DRAFT' END;
ALTER TABLE cap_entry ALTER COLUMN status SET NOT NULL;
ALTER TABLE cap_entry ADD CONSTRAINT cap_entry_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'FAILED'));
ALTER TABLE cap_entry DROP COLUMN published;

ALTER TABLE cap_entry ADD COLUMN scheduled_at timestamptz;
ALTER TABLE cap_entry ADD COLUMN publication_failure text CHECK (char_length(publication_failure) <= 500);
ALTER TABLE cap_entry ADD CONSTRAINT cap_entry_scheduled_is_draft CHECK (scheduled_at IS NULL OR status IN ('DRAFT', 'FAILED'));
ALTER TABLE cap_entry ADD CONSTRAINT cap_entry_failure_has_reason CHECK ((status = 'FAILED') = (publication_failure IS NOT NULL));

CREATE INDEX cap_entry_scheduled_at_idx ON cap_entry (scheduled_at) WHERE status = 'DRAFT' AND scheduled_at IS NOT NULL;

-- The badge of "Corbeille": what the other admins put there since this one last opened it.
ALTER TABLE admin_seen DROP CONSTRAINT admin_seen_topic_check;
ALTER TABLE admin_seen ADD CONSTRAINT admin_seen_topic_check CHECK (topic IN ('HISTORY', 'CHANGELOG', 'LOGS', 'TRASH'));
