-- 2.17.0: nutrition facts closer to the plate.

-- The share of an ingredient, as bought, that is eaten (Ciqual gives its values for the edible part): 68 for a
-- whole chicken (bones), 64 for bananas (skin). Applies to every quantity of the ingredient in the recipes.
ALTER TABLE ingredient ADD COLUMN edible_percent smallint NOT NULL DEFAULT 100 CHECK (edible_percent BETWEEN 1 AND 100);

-- cooked_grams: the weight of the whole recipe once cooked, given by the admin; the facts per 100 g and the
-- Nutri-Score are then those of the dish as eaten (a cake loses water in the oven). Null: the raw weight.
-- nutri_score_kind: the grid of the Nutri-Score the recipe is graded with, as the 2023 algorithm has one for
-- beverages, one for fats, oils, nuts and seeds, and its own rules for red meat and cheese.
ALTER TABLE recipe
    ADD COLUMN cooked_grams     integer CHECK (cooked_grams BETWEEN 1 AND 100000),
    ADD COLUMN nutri_score_kind text NOT NULL DEFAULT 'GENERAL'
        CHECK (nutri_score_kind IN ('GENERAL', 'RED_MEAT', 'CHEESE', 'FATS', 'BEVERAGE'));
