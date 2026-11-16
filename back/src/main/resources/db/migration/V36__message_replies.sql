-- 2.22.0. "Répondre", as on Instagram: a message may answer another one of the same group, shown quoted above it.
-- The message answered deleted (by its author, or after 90 days): the answer stays, without its quote.
ALTER TABLE admin_message ADD COLUMN reply_to_id bigint REFERENCES admin_message (id) ON DELETE SET NULL;

CREATE INDEX admin_message_reply_to_idx ON admin_message (reply_to_id) WHERE reply_to_id IS NOT NULL;
