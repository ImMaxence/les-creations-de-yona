-- New social networks.
ALTER TABLE social_link DROP CONSTRAINT social_link_platform_check;
ALTER TABLE social_link ADD CONSTRAINT social_link_platform_check CHECK (platform IN
    ('YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'REDDIT', 'X', 'THREADS', 'WHATSAPP'));

-- Uploaded images are kept, even once replaced, and one image can be shown by several recipes or
-- categories: the gallery is where the admin sorts them out.
ALTER TABLE recipe DROP CONSTRAINT recipe_image_id_key;
ALTER TABLE category DROP CONSTRAINT category_image_id_key;
CREATE INDEX recipe_image_id_idx ON recipe (image_id);
CREATE INDEX category_image_id_idx ON category (image_id);

-- Look of the public site, chosen in the back-office. A single row (id = 1).
CREATE TABLE site_theme (
    id            smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    preset        text        NOT NULL CHECK (preset IN ('PATISSERIE_CHIC', 'TERRACOTTA', 'PISTACHE', 'MYRTILLE', 'CARAMEL')),
    display_font  text        NOT NULL CHECK (display_font IN ('FRAUNCES', 'PLAYFAIR_DISPLAY', 'CORMORANT_GARAMOND', 'DANCING_SCRIPT', 'QUICKSAND')),
    body_font     text        NOT NULL CHECK (body_font IN ('INTER', 'NUNITO', 'DM_SANS', 'SOURCE_SANS_3', 'LORA')),
    radius_px     integer     NOT NULL CHECK (radius_px BETWEEN 0 AND 999),
    updated_at    timestamptz NOT NULL,
    updated_by    text        NOT NULL
);

INSERT INTO site_theme (preset, display_font, body_font, radius_px, updated_at, updated_by)
VALUES ('PATISSERIE_CHIC', 'FRAUNCES', 'INTER', 16, now(), 'migration');
