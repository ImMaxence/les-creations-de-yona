-- A photo chosen for a menu (3.7): on its card and at the top of its page. Without one, the menu
-- shows the photo of its first recipe that has one, as before. Uploaded from the menu: kind MENU,
-- in the menus/ folder; it can also come from the gallery.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check
    CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY', 'SITE', 'PINTEREST', 'MENU'));

ALTER TABLE menu ADD COLUMN image_id uuid REFERENCES image (id) ON DELETE SET NULL;
CREATE INDEX menu_image_id_idx ON menu (image_id);
