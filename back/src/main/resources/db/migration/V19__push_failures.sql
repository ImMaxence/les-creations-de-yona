-- 1.18.1

-- Sendings refused in a row by the push service (400, 403…): a subscription refused 3 times is removed, so that
-- forged subscriptions do not stay for good. Back to 0 after a delivery.
ALTER TABLE push_subscription ADD COLUMN failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0);
