-- A recipe can be in several categories. The first one (position 0) is its main category, the one
-- in its URL.
CREATE TABLE recipe_category (
    recipe_id    bigint  NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    -- No cascade: deleting a category that still contains recipes is refused.
    category_id  bigint  NOT NULL REFERENCES category (id),
    position     integer NOT NULL CHECK (position >= 0),
    PRIMARY KEY (recipe_id, position),
    -- Deferred to the end of the transaction so that choosing another main category can swap two.
    CONSTRAINT recipe_category_category_key UNIQUE (recipe_id, category_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX recipe_category_category_id_idx ON recipe_category (category_id);

INSERT INTO recipe_category (recipe_id, category_id, position) SELECT id, category_id, 0 FROM recipe;

-- Also drops recipe_category_id_idx.
ALTER TABLE recipe DROP COLUMN category_id;

-- Parts of a recipe (the dough, the filling…), each with its own ingredients and steps. A recipe
-- without parts has a single, untitled one.
CREATE TABLE recipe_part (
    id         bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id  bigint  NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    position   integer NOT NULL CHECK (position >= 0),
    title      text,
    -- Deferred: parts are rewritten on each save, new ones being inserted before old ones are deleted.
    CONSTRAINT recipe_part_position_key UNIQUE (recipe_id, position) DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO recipe_part (recipe_id, position) SELECT id, 0 FROM recipe;

-- Ingredient lines move to the part: the same ingredient can now appear in several parts.
ALTER TABLE recipe_ingredient ADD COLUMN part_id bigint REFERENCES recipe_part (id) ON DELETE CASCADE;
UPDATE recipe_ingredient line SET part_id = part.id FROM recipe_part part WHERE part.recipe_id = line.recipe_id;
ALTER TABLE recipe_ingredient ALTER COLUMN part_id SET NOT NULL;
ALTER TABLE recipe_ingredient
    DROP CONSTRAINT recipe_ingredient_pkey,
    DROP CONSTRAINT recipe_ingredient_position_key,
    DROP COLUMN recipe_id;
ALTER TABLE recipe_ingredient ADD PRIMARY KEY (part_id, ingredient_id);
ALTER TABLE recipe_ingredient
    ADD CONSTRAINT recipe_ingredient_position_key UNIQUE (part_id, position) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE recipe_step ADD COLUMN part_id bigint REFERENCES recipe_part (id) ON DELETE CASCADE;
UPDATE recipe_step step SET part_id = part.id FROM recipe_part part WHERE part.recipe_id = step.recipe_id;
ALTER TABLE recipe_step ALTER COLUMN part_id SET NOT NULL;
ALTER TABLE recipe_step DROP CONSTRAINT recipe_step_pkey, DROP COLUMN recipe_id;
ALTER TABLE recipe_step ADD PRIMARY KEY (part_id, position);

-- Recipe titles and category names start with a capital letter, as the services now save them.
UPDATE recipe SET title = upper(left(title, 1)) || substr(title, 2) WHERE left(title, 1) <> upper(left(title, 1));
UPDATE category SET name = upper(left(name, 1)) || substr(name, 2) WHERE left(name, 1) <> upper(left(name, 1));
