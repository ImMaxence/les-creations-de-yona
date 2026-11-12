-- 2.11.0. "Journaux": a line archived (the problem handled) leaves the list without being erased; the
-- same problem happening again brings it back, marked as come back.
ALTER TABLE app_log
    ADD COLUMN archived_at timestamptz,
    ADD COLUMN came_back   boolean NOT NULL DEFAULT false;
