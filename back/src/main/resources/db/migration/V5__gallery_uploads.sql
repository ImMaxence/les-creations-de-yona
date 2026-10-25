-- Photos can also be uploaded straight to the gallery, before being shown anywhere.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY'));
