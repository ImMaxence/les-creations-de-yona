-- 1.16.0

-- "Questions fréquentes" of a recipe, in order: shown under the recipe, read by search engines and AI assistants.
CREATE TABLE recipe_question (
    recipe_id  bigint  NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    question   text    NOT NULL CHECK (length(question) BETWEEN 1 AND 200),
    answer     text    NOT NULL CHECK (length(answer) BETWEEN 1 AND 2000),
    PRIMARY KEY (recipe_id, position)
);

-- Visits coming from an AI assistant (ChatGPT, Perplexity…), counted per day and per assistant: nothing about
-- the visitor. Erased after 13 months.
CREATE TABLE ai_visit (
    day        date    NOT NULL,
    assistant  text    NOT NULL CHECK (length(assistant) BETWEEN 1 AND 30),
    count      integer NOT NULL CHECK (count > 0),
    PRIMARY KEY (day, assistant)
);
