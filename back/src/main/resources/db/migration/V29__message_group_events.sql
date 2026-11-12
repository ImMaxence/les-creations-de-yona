-- System messages (2.13): what a member changed in the group, written in its conversation as a line of its own.
-- event: what happened; event_value: the name given (CREATED, RENAMED) or the member concerned (ADDED, REMOVED).
-- body keeps a sentence of it in French, for the list of the groups and the backups.
ALTER TABLE admin_message
    ADD COLUMN event       text CHECK (event IN ('CREATED', 'RENAMED', 'PHOTO_CHANGED', 'PHOTO_REMOVED', 'ADDED', 'REMOVED', 'LEFT')),
    ADD COLUMN event_value text CHECK (char_length(event_value) <= 320);
