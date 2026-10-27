-- Shop aisle of an ingredient, set once in the back-office: the shopping list is sorted by aisle.
-- No aisle: listed last ("Autres").
ALTER TABLE ingredient ADD COLUMN aisle text CHECK (aisle IN ('FRUITS_VEGETABLES', 'MEAT_FISH', 'DAIRY_EGGS',
    'BAKERY', 'SAVORY_GROCERY', 'SWEET_GROCERY', 'FROZEN', 'DRINKS'));

-- Equipment the recipe needs (moule à tarte, fouet, poche à douille…), one item per line, in order;
-- shown on the recipe and with the mise en place of the cooking mode.
ALTER TABLE recipe ADD COLUMN equipment text;
