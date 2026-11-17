-- 2.24.0. "Mes notifications": a visitor chooses what their device is told, the new recipes and the new articles of
-- "Mon CAP". The devices already subscribed asked for the recipes only: they keep the recipes only.
ALTER TABLE push_subscription ADD COLUMN new_articles boolean NOT NULL DEFAULT false;

-- An article is told once, at its first publication, as a recipe is (recipe.published_at). The articles already
-- published are not told now.
ALTER TABLE cap_entry ADD COLUMN published_at timestamptz;
UPDATE cap_entry SET published_at = updated_at WHERE status = 'PUBLISHED';
