-- 1.11.0

-- The theme belongs to the category: "Desserts" is sweet, "Plats" savory, "Apéritifs" both (null). A
-- recipe takes the theme of its main category; only a recipe whose main category holds both chooses
-- its own.
ALTER TABLE category ADD COLUMN theme text CHECK (theme IN ('SWEET', 'SAVORY'));

-- The categories written before, guessed from their name; the others hold both, to correct by hand
-- in the back-office (Catégories).
UPDATE category SET theme = 'SWEET'
WHERE unaccent(lower(name)) ~ '(dessert|patisser|gateau|biscuit|cookie|gouter|confiser|glace|sorbet|crepe|gaufre|viennoiser|brioche|chocolat|douceur|sucre|entremet|macaron|confiture|cupcake|muffin|bonbon)';
UPDATE category SET theme = 'SAVORY'
WHERE theme IS NULL
    AND unaccent(lower(name)) ~ '(plat|entree|soupe|veloute|salade|accompagnement|quiche|pizza|sauce|viande|volaille|poisson|fruits de mer|legume|gratin|feculent|pates|riz|burger|sandwich|sale|tartine|cake sale|terrine)';

-- Recipes follow their main category. A featured recipe moving to a theme that has one already is
-- featured no more: one featured recipe per theme.
UPDATE recipe r SET featured = false
FROM recipe_category link JOIN category c ON c.id = link.category_id
WHERE link.recipe_id = r.id AND link.position = 0 AND c.theme IS NOT NULL AND r.theme <> c.theme
    AND r.featured AND r.status = 'PUBLISHED'
    AND EXISTS (SELECT 1 FROM recipe other WHERE other.featured AND other.status = 'PUBLISHED' AND other.theme = c.theme
        AND other.id <> r.id);
UPDATE recipe r SET theme = c.theme
FROM recipe_category link JOIN category c ON c.id = link.category_id
WHERE link.recipe_id = r.id AND link.position = 0 AND c.theme IS NOT NULL AND r.theme <> c.theme;
