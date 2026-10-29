-- 1.12.0

-- What an update changed, field by field: a JSON list of {field, before, after}. Null for the lines
-- written before, and for the actions that change no field (trash, backup…).
ALTER TABLE audit_event ADD COLUMN changes jsonb;

-- A single featured recipe again, instead of one per theme: the latest published of them stays.
-- A scheduled one featured ahead keeps its flag, and replaces it once published.
UPDATE recipe SET featured = false
WHERE featured AND status = 'PUBLISHED'
    AND id <> (SELECT id FROM recipe WHERE featured AND status = 'PUBLISHED' ORDER BY published_at DESC NULLS LAST, id DESC LIMIT 1);
DROP INDEX recipe_single_featured_idx;
CREATE UNIQUE INDEX recipe_single_featured_idx ON recipe (featured) WHERE featured AND status = 'PUBLISHED';
