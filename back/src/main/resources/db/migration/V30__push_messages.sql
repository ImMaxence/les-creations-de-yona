-- Notifications of the messages between admins (2.13): the admin whose messages this device is told of,
-- none otherwise. A device of the back-office receives the messages of the admin who turned them on there.
ALTER TABLE push_subscription ADD COLUMN messages_for text CHECK (char_length(messages_for) BETWEEN 3 AND 320);

CREATE INDEX push_subscription_messages_for_idx ON push_subscription (messages_for) WHERE messages_for IS NOT NULL;
