-- Ten more color themes, five more title fonts and five more text fonts.
ALTER TABLE site_theme DROP CONSTRAINT site_theme_preset_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_preset_check CHECK (preset IN (
    'PATISSERIE_CHIC', 'TERRACOTTA', 'PISTACHE', 'MYRTILLE', 'CARAMEL',
    'FRAMBOISE', 'LAVANDE', 'MENTHE', 'CITRON', 'CHOCOLAT', 'CERISE', 'AMANDE', 'BLEUET', 'ABRICOT', 'FIGUE'));
ALTER TABLE site_theme DROP CONSTRAINT site_theme_display_font_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_display_font_check CHECK (display_font IN (
    'FRAUNCES', 'PLAYFAIR_DISPLAY', 'CORMORANT_GARAMOND', 'DANCING_SCRIPT', 'QUICKSAND',
    'BODONI_MODA', 'CINZEL', 'EB_GARAMOND', 'CAVEAT', 'COMFORTAA'));
ALTER TABLE site_theme DROP CONSTRAINT site_theme_body_font_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_body_font_check CHECK (body_font IN (
    'INTER', 'NUNITO', 'DM_SANS', 'SOURCE_SANS_3', 'LORA',
    'OPEN_SANS', 'MONTSERRAT', 'WORK_SANS', 'MANROPE', 'MERRIWEATHER'));

-- Photos uploaded for the "À propos" section of the home page.
ALTER TABLE image DROP CONSTRAINT image_kind_check;
ALTER TABLE image ADD CONSTRAINT image_kind_check CHECK (kind IN ('RECIPE', 'CATEGORY', 'GALLERY', 'SITE'));

-- Texts and photo edited in the back-office. The site's name and icon stay in the code (SEO, PWA).
-- A single row (id = 1); without a photo, the home page shows the one bundled with the front.
CREATE TABLE site_content (
    id              smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    about_title     text        NOT NULL,
    about_text      text        NOT NULL,
    about_image_id  uuid        REFERENCES image (id) ON DELETE SET NULL,
    footer_text     text        NOT NULL,
    updated_at      timestamptz NOT NULL,
    updated_by      text        NOT NULL
);

INSERT INTO site_content (about_title, about_text, footer_text, updated_at, updated_by)
VALUES ('Bienvenue dans ma cuisine',
        'Je m''appelle Yona, je relève un grand défi en me lançant dans une aventure extraordinaire : faire de ma passion un métier et obtenir mon CAP Pâtisserie !',
        'Des recettes maison, à partager sans modération.',
        now(), 'migration');
